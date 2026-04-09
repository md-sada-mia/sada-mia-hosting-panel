<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class ApiDocsController extends Controller
{
    private function getDocsData()
    {
        return [
            'info' => [
                'title' => 'Domain Subscription & CRM API',
                'version' => '1.0.0',
                'description' => 'API documentation for managing Domain Deployments and Subscriptions in Sada Mia Hosting Panel.'
            ],
            'endpoints' => [
                [
                    'method' => 'POST',
                    'path' => '/api/customers',
                    'title' => 'Create Customer',
                    'description' => 'Create a new CRM Customer record which will own a domain deployment.',
                    'auth' => 'Bearer Token',
                    'parameters' => [
                        ['name' => 'name', 'type' => 'string', 'required' => true, 'description' => 'Customer full name'],
                        ['name' => 'email', 'type' => 'string', 'required' => false, 'description' => 'Customer email address'],
                        ['name' => 'business_name', 'type' => 'string', 'required' => false, 'description' => 'Business name'],
                        ['name' => 'phone', 'type' => 'string', 'required' => false, 'description' => 'Contact phone number'],
                    ],
                    'response' => [
                        'status' => 201,
                        'body' => '{"id": 1, "name": "John Doe", "email": "john@example.com", "status": "lead"}'
                    ]
                ],
                [
                    'method' => 'POST',
                    'path' => '/api/customers/{id}/deploy',
                    'title' => 'Deploy Domain for Customer',
                    'description' => 'Deploy an App or Load Balancer for the customer with a specific domain.',
                    'auth' => 'Bearer Token',
                    'parameters' => [
                        ['name' => 'domain', 'type' => 'string', 'required' => true, 'description' => 'The domain name to deploy (e.g., example.com)'],
                        ['name' => 'type', 'type' => 'string', 'required' => false, 'description' => 'App type: nextjs, laravel, static (default: nextjs)'],
                        ['name' => 'git_url', 'type' => 'string', 'required' => false, 'description' => 'Git repository URL if deploying an App'],
                    ],
                    'response' => [
                        'status' => 200,
                        'body' => '{"id": 1, "resource_type": "app", "status": "active", "resource": {"domain": "example.com"}}'
                    ]
                ],
                [
                    'method' => 'GET',
                    'path' => '/api/subscription/plans',
                    'title' => 'List Subscription Plans',
                    'description' => 'Get a list of available active subscription plans in the system.',
                    'auth' => 'Public / Bearer Token',
                    'parameters' => [
                        ['name' => 'type', 'type' => 'string', 'required' => false, 'description' => 'Filter by type: flat_rate or request_credit']
                    ],
                    'response' => [
                        'status' => 200,
                        'body' => '{"plans": [{"id": 1, "name": "Pro Plan", "price": "10.00", "billing_cycle": "monthly"}]}'
                    ]
                ],
                [
                    'method' => 'POST',
                    'path' => '/api/subscription/subscribe',
                    'title' => 'Initiate Subscription',
                    'description' => 'Initiate a subscription payment via a gateway.',
                    'auth' => 'Bearer Token',
                    'parameters' => [
                        ['name' => 'plan_id', 'type' => 'integer', 'required' => true, 'description' => 'ID of the subscription plan'],
                        ['name' => 'gateway', 'type' => 'string', 'required' => true, 'description' => 'Payment gateway: bkash, nagad, sslcommerz'],
                        ['name' => 'domain', 'type' => 'string', 'required' => false, 'description' => 'Optional domain context']
                    ],
                    'response' => [
                        'status' => 200,
                        'body' => '{"transaction_id": 123, "payment_url": "https://sandbox.bka.sh/.../...", "gateway": "bkash"}'
                    ]
                ],
                [
                    'method' => 'POST',
                    'path' => '/api/subscription/cancel',
                    'title' => 'Cancel Subscription',
                    'description' => 'Cancel the currently active flat-rate subscription for the authenticated user.',
                    'auth' => 'Bearer Token',
                    'parameters' => [],
                    'response' => [
                        'status' => 200,
                        'body' => '{"message": "Subscription cancelled."}'
                    ]
                ],
                [
                    'method' => 'GET',
                    'path' => '/api/subscription/current',
                    'title' => 'Current Subscription Status',
                    'description' => 'Get the current subscription status and credit balance of the authenticated user.',
                    'auth' => 'Bearer Token',
                    'parameters' => [],
                    'response' => [
                        'status' => 200,
                        'body' => '{"is_active": true, "plan": "Pro Plan", "credit_balance": 100, "status": "active"}'
                    ]
                ],
                [
                    'method' => 'GET',
                    'path' => '/api/public/subscription/status',
                    'title' => 'Public Subscription Status',
                    'description' => 'Get expiration info and payment redirection URL for a specific domain.',
                    'auth' => 'Public',
                    'parameters' => [
                        ['name' => 'domain', 'type' => 'string', 'required' => false, 'description' => 'The domain to check. Defaults to the requesting host if omitted.']
                    ],
                    'response' => [
                        'status' => 200,
                        'body' => '{"domain": "example.com", "is_expired": true, "payment_url": "https://pay.domain.com", "support": {"email": "support@domain.com"}}'
                    ]
                ]
            ]
        ];
    }

    public function index()
    {
        return response()->json($this->getDocsData());
    }

    public function indexWeb()
    {
        return view('api-docs', $this->getDocsData());
    }
}
