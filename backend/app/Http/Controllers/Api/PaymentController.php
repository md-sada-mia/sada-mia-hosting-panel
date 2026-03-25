<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentTransaction;
use App\Models\SubscriptionPlan;
use App\Services\SubscriptionService;
use App\Services\BkashPaymentService;
use App\Services\NagadPaymentService;
use App\Services\SslCommercePaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PaymentController extends Controller
{
    public function __construct(
        private SubscriptionService       $subscriptionService,
        private BkashPaymentService       $bkash,
        private NagadPaymentService       $nagad,
        private SslCommercePaymentService $sslCommerz,
    ) {}

    // ── bKash callback ────────────────────────────────────────────────────────

    public function bkashCallback(Request $request)
    {
        $txId      = $request->query('tx_id');
        $paymentId = $request->query('paymentID');
        $status    = $request->query('status'); // success | cancel | failure

        $transaction = PaymentTransaction::find($txId);

        if (!$transaction || !$transaction->isPending()) {
            return $this->redirectResult('failed', 'bkash');
        }

        if ($status !== 'success' || !$paymentId) {
            $transaction->update(['status' => 'failed', 'raw_response' => $request->all()]);
            return $this->redirectResult('failed', 'bkash');
        }

        try {
            $executeResult = $this->bkash->executePayment($paymentId);

            if (($executeResult['statusCode'] ?? '') !== '0000') {
                $transaction->update(['status' => 'failed', 'raw_response' => $executeResult]);
                return $this->redirectResult('failed', 'bkash');
            }

            $this->completeTransaction($transaction, $executeResult['trxID'] ?? null, $executeResult);
            return $this->redirectResult('success', 'bkash');
        } catch (\Exception $e) {
            Log::error('bKash callback execution error: ' . $e->getMessage());
            $transaction->update(['status' => 'failed']);
            return $this->redirectResult('failed', 'bkash');
        }
    }

    // ── Nagad callback ────────────────────────────────────────────────────────

    public function nagadCallback(Request $request)
    {
        $txId         = $request->query('tx_id');
        $paymentRefId = $request->query('payment_ref_id');

        $transaction = PaymentTransaction::find($txId);

        if (!$transaction || !$transaction->isPending()) {
            return $this->redirectResult('failed', 'nagad');
        }

        try {
            $result = $this->nagad->verifyPayment($paymentRefId);

            if (($result['status'] ?? '') !== 'Success') {
                $transaction->update(['status' => 'failed', 'raw_response' => $result]);
                return $this->redirectResult('failed', 'nagad');
            }

            $this->completeTransaction($transaction, $result['merchantOrderId'] ?? $paymentRefId, $result);
            return $this->redirectResult('success', 'nagad');
        } catch (\Exception $e) {
            Log::error('Nagad callback error: ' . $e->getMessage());
            $transaction->update(['status' => 'failed']);
            return $this->redirectResult('failed', 'nagad');
        }
    }

    // ── SSL Commerce callbacks ─────────────────────────────────────────────────

    public function sslSuccess(Request $request)
    {
        return $this->handleSslCallback($request, 'success');
    }

    public function sslFail(Request $request)
    {
        return $this->handleSslCallback($request, 'failed');
    }

    public function sslCancel(Request $request)
    {
        return $this->handleSslCallback($request, 'failed');
    }

    public function sslIpn(Request $request)
    {
        $data = $request->all();

        if (!$this->sslCommerz->verifyIpn($data)) {
            return response()->json(['message' => 'IPN hash mismatch'], 400);
        }

        $txId = $request->query('tx_id') ?? ($data['value_a'] ?? null);
        $transaction = PaymentTransaction::find($txId);

        if (!$transaction || !$transaction->isPending()) {
            return response()->json(['message' => 'Transaction not found or already processed'], 400);
        }

        if (($data['status'] ?? '') === 'VALID') {
            $this->completeTransaction($transaction, $data['bank_tran_id'] ?? null, $data);
        } else {
            $transaction->update(['status' => 'failed', 'raw_response' => $data]);
        }

        return response()->json(['message' => 'IPN processed']);
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private function handleSslCallback(Request $request, string $outcome)
    {
        $txId = $request->query('tx_id');
        $transaction = PaymentTransaction::find($txId);

        if (!$transaction || !$transaction->isPending()) {
            return $this->redirectResult($outcome, 'sslcommerz');
        }

        if ($outcome === 'success') {
            $data = $request->all();
            try {
                $validated = $this->sslCommerz->validatePayment($data['val_id'] ?? $data['tran_id'] ?? '');
                if (($validated['status'] ?? '') === 'VALID') {
                    $this->completeTransaction($transaction, $data['bank_tran_id'] ?? null, $validated);
                    return $this->redirectResult('success', 'sslcommerz');
                }
            } catch (\Exception $e) {
                Log::error('SSL Commerce validation error: ' . $e->getMessage());
            }
        }

        $transaction->update(['status' => 'failed', 'raw_response' => $request->all()]);
        return $this->redirectResult('failed', 'sslcommerz');
    }

    /**
     * Mark transaction completed and activate subscription.
     */
    private function completeTransaction(PaymentTransaction $transaction, ?string $txnId, array $raw): void
    {
        $transaction->update([
            'status'         => 'completed',
            'transaction_id' => $txnId,
            'raw_response'   => $raw,
        ]);

        $user = $transaction->user;
        $plan = SubscriptionPlan::findOrFail($transaction->plan_id);

        $this->subscriptionService->activate($user, $plan, $transaction);
    }

    /**
     * Redirect to the frontend result page.
     */
    private function redirectResult(string $status, string $gateway)
    {
        $baseUrl = \App\Models\Setting::get('payment_callback_base_url');

        if (!$baseUrl) {
            $baseUrl = config('app.frontend_url', rtrim(config('app.url'), '/'));
        }

        $baseUrl = rtrim($baseUrl, '/');
        return redirect("{$baseUrl}/payment/result?status={$status}&gateway={$gateway}");
    }
}
