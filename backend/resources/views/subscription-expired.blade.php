<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Subscription Expired — Service Suspended</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        *,
        *::before,
        *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        :root {
            --bg: #0a0a0f;
            --surface: #111118;
            --border: rgba(255, 255, 255, 0.07);
            --red: #ff4560;
            --red-dim: rgba(255, 69, 96, 0.12);
            --red-glow: rgba(255, 69, 96, 0.25);
            --amber: #f59e0b;
            --amber-dim: rgba(245, 158, 11, 0.10);
            --text: #e2e8f0;
            --muted: #64748b;
            --card-bg: rgba(17, 17, 24, 0.95);
        }

        body {
            font-family: 'Inter', system-ui, sans-serif;
            background: var(--bg);
            color: var(--text);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            overflow: hidden;
            position: relative;
        }

        /* Animated background grid */
        body::before {
            content: '';
            position: fixed;
            inset: 0;
            background-image:
                linear-gradient(rgba(255, 69, 96, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 69, 96, 0.03) 1px, transparent 1px);
            background-size: 48px 48px;
            mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
            z-index: 0;
            animation: gridPulse 8s ease-in-out infinite;
        }

        @keyframes gridPulse {

            0%,
            100% {
                opacity: .6
            }

            50% {
                opacity: 1
            }
        }

        /* Ambient glow blobs */
        body::after {
            content: '';
            position: fixed;
            top: -20%;
            left: -10%;
            width: 60%;
            height: 60%;
            background: radial-gradient(ellipse, rgba(255, 69, 96, 0.08) 0%, transparent 70%);
            z-index: 0;
            animation: float 12s ease-in-out infinite;
        }

        @keyframes float {

            0%,
            100% {
                transform: translate(0, 0)
            }

            50% {
                transform: translate(3%, 5%)
            }
        }

        .wrapper {
            position: relative;
            z-index: 1;
            width: 100%;
            max-width: 680px;
        }

        /* Animated border glow card */
        .card {
            background: var(--card-bg);
            border: 1px solid rgba(255, 69, 96, 0.25);
            border-radius: 24px;
            padding: 3rem 3rem 2.5rem;
            box-shadow:
                0 0 0 1px rgba(255, 69, 96, 0.05),
                0 0 80px rgba(255, 69, 96, 0.08),
                0 32px 64px rgba(0, 0, 0, 0.5);
            animation: borderGlow 3s ease-in-out infinite;
            backdrop-filter: blur(20px);
        }

        @keyframes borderGlow {

            0%,
            100% {
                box-shadow: 0 0 0 1px rgba(255, 69, 96, 0.05), 0 0 80px rgba(255, 69, 96, 0.08), 0 32px 64px rgba(0, 0, 0, 0.5);
            }

            50% {
                box-shadow: 0 0 0 1px rgba(255, 69, 96, 0.15), 0 0 120px rgba(255, 69, 96, 0.15), 0 32px 64px rgba(0, 0, 0, 0.5);
            }
        }

        /* Top status strip */
        .status-strip {
            display: flex;
            align-items: center;
            gap: 8px;
            background: var(--red-dim);
            border: 1px solid rgba(255, 69, 96, 0.2);
            border-radius: 100px;
            padding: 6px 14px 6px 10px;
            width: fit-content;
            margin-bottom: 2rem;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--red);
            animation: ping 1.5s ease-in-out infinite;
            flex-shrink: 0;
        }

        @keyframes ping {

            0%,
            100% {
                transform: scale(1);
                opacity: 1;
                box-shadow: 0 0 0 0 var(--red-glow);
            }

            50% {
                transform: scale(1.2);
                opacity: .8;
                box-shadow: 0 0 0 6px transparent;
            }
        }

        .status-text {
            font-size: 12px;
            font-weight: 600;
            color: var(--red);
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }

        /* Lock icon */
        .icon-wrap {
            width: 72px;
            height: 72px;
            border-radius: 20px;
            background: var(--red-dim);
            border: 1px solid rgba(255, 69, 96, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 1.5rem;
            animation: iconFloat 4s ease-in-out infinite;
        }

        @keyframes iconFloat {

            0%,
            100% {
                transform: translateY(0)
            }

            50% {
                transform: translateY(-4px)
            }
        }

        .icon-wrap svg {
            width: 36px;
            height: 36px;
            color: var(--red);
        }

        h1 {
            font-size: 2rem;
            font-weight: 800;
            line-height: 1.15;
            letter-spacing: -0.03em;
            color: #fff;
            margin-bottom: 0.75rem;
        }

        .subtitle {
            font-size: 0.95rem;
            color: var(--muted);
            line-height: 1.7;
            max-width: 480px;
            margin-bottom: 2rem;
        }

        .domain-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 10px 16px;
            margin-bottom: 2rem;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            color: #a1a1aa;
        }

        .domain-pill svg {
            width: 14px;
            height: 14px;
            color: var(--muted);
            flex-shrink: 0;
        }

        /* Steps to reactivate */
        .steps-title {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--muted);
            margin-bottom: 1rem;
        }

        .steps {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 2rem;
        }

        .step {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            background: rgba(255, 255, 255, 0.025);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 14px 16px;
            transition: background .2s;
        }

        .step-num {
            width: 26px;
            height: 26px;
            border-radius: 8px;
            background: var(--amber-dim);
            border: 1px solid rgba(245, 158, 11, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 700;
            color: var(--amber);
            flex-shrink: 0;
            margin-top: 1px;
        }

        .step-body strong {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: #e2e8f0;
            margin-bottom: 2px;
        }

        .step-body span {
            font-size: 12px;
            color: var(--muted);
            line-height: 1.5;
        }

        /* Divider */
        .divider {
            height: 1px;
            background: var(--border);
            margin: 2rem 0;
        }

        /* Footer */
        .footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
        }

        .footer-info {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: var(--muted);
        }

        .footer-info svg {
            width: 14px;
            height: 14px;
        }

        .contact-link {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            font-weight: 500;
            color: var(--red);
            text-decoration: none;
            border: 1px solid rgba(255, 69, 96, 0.25);
            border-radius: 10px;
            padding: 8px 16px;
            transition: all .2s;
            background: var(--red-dim);
        }

        .contact-link:hover {
            background: rgba(255, 69, 96, 0.18);
            border-color: rgba(255, 69, 96, 0.5);
            transform: translateY(-1px);
        }

        .contact-link svg {
            width: 14px;
            height: 14px;
        }

        /* Error code badge */
        .error-badge {
            position: absolute;
            top: 1.5rem;
            right: 1.5rem;
            background: rgba(255, 69, 96, 0.08);
            border: 1px solid rgba(255, 69, 96, 0.15);
            border-radius: 8px;
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 700;
            color: rgba(255, 69, 96, 0.5);
            letter-spacing: 0.05em;
            font-family: monospace;
        }

        @media (max-width: 600px) {
            .card {
                padding: 2rem 1.5rem;
            }

            h1 {
                font-size: 1.6rem;
            }

            .footer {
                flex-direction: column;
                align-items: flex-start;
            }
        }
    </style>
</head>

<body>
    <div class="wrapper">
        <div class="card" style="position: relative;">
            <span class="error-badge">HTTP 402</span>

            <!-- Status indicator -->
            <div class="status-strip">
                <span class="status-dot"></span>
                <span class="status-text">Service Suspended</span>
            </div>

            <!-- Icon -->
            <div class="icon-wrap">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
            </div>

            <!-- Heading -->
            <h1>Subscription Expired</h1>
            <p class="subtitle">
                Access to this application has been suspended because the subscription for this domain has expired or is no longer active. Please renew your plan to restore service.
            </p>

            <!-- Domain display -->
            <div class="domain-pill">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                </svg>
                <span id="domain-display">{{ $domain }}</span>
            </div>

            <!-- Steps -->
            <p class="steps-title">How to reactivate</p>
            <div class="steps">
                <div class="step">
                    <div class="step-num">1</div>
                    <div class="step-body">
                        <strong>Contact your service provider</strong>
                        <span>Reach out to your hosting provider or administrator to renew or activate a subscription plan for this domain.</span>
                    </div>
                </div>
                <div class="step">
                    <div class="step-num">2</div>
                    <div class="step-body">
                        <strong>Select a plan &amp; complete payment</strong>
                        <span>Choose an appropriate subscription plan and complete the payment through the billing portal.</span>
                    </div>
                </div>
                <div class="step">
                    <div class="step-num">3</div>
                    <div class="step-body">
                        <strong>Automatic restoration</strong>
                        <span>Once your subscription is confirmed, this domain will be automatically reactivated and fully accessible within minutes.</span>
                    </div>
                </div>
            </div>

            <div class="divider"></div>

            <!-- Footer -->
            <div class="footer">
                <div class="footer-actions" style="display: flex; gap: 12px; width: 100%;">
                    <a href="{{ $payment_url }}/packages?domain={{ $domain }}" class="contact-link" style="background: var(--red); color: white; border: none; flex: 1; justify-content: center; font-weight: 700; padding: 12px;">

                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;">
                            <path d="M12 2v10"></path>
                            <path d="M18.4 4.6a10 10 0 1 1-12.8 0"></path>
                        </svg>
                        Renew Subscription
                    </a>
                    <a href="mailto:{{ $support_email }}?subject=Subscription%20Issue%20for%20{{ $domain }}" class="contact-link" style="flex: 1; justify-content: center;">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.27-2.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                        Contact Support
                    </a>
                </div>

                <div class="footer-info" style="margin-top: 1.5rem; width: 100%; justify-content: center; opacity: 0.7;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    Your data is safe &amp; preserved during suspension
                </div>
            </div>
        </div>
    </div>
</body>

</html>