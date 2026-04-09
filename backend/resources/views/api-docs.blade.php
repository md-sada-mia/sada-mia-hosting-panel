<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $info['title'] }} - API Documentation</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        primary: '#6d28d9', // violet-700
                    }
                }
            }
        }
    </script>
    <style>
        body { background-color: #0c0a09; color: #f5f5f4; font-family: ui-sans-serif, system-ui, sans-serif; }
        .glass-card {
            background-color: rgba(28, 25, 23, 0.7);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(68, 64, 60, 0.4);
        }
        .method-GET { background-color: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
        .method-POST { background-color: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.2); }
        .method-PUT { background-color: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }
        .method-DELETE { background-color: rgba(244, 63, 94, 0.1); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.2); }
    </style>
    <script>
        function toggleEndpoint(index) {
            const el = document.getElementById('endpoint-body-' + index);
            const icon = document.getElementById('endpoint-icon-' + index);
            if (el.style.display === 'none') {
                el.style.display = 'block';
                icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
            } else {
                el.style.display = 'none';
                icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
            }
        }
    </script>
</head>
<body class="antialiased min-h-screen selection:bg-primary selection:text-white">

    <header class="border-b border-stone-800 bg-stone-900/50 sticky top-0 z-30 backdrop-blur-md">
        <div class="container mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                </div>
                <div>
                    <h1 class="font-bold text-lg leading-none tracking-tight">{{ $info['title'] }}</h1>
                    <span class="text-xs text-stone-400">Version {{ $info['version'] }}</span>
                </div>
            </div>
        </div>
    </header>

    <main class="container mx-auto px-4 lg:px-8 py-10 max-w-5xl">
        <div class="mb-12 text-center md:text-left">
            <h2 class="text-3xl font-extrabold tracking-tight mb-4 text-white">API Reference</h2>
            <p class="text-lg text-stone-400 leading-relaxed max-w-3xl">
                {{ $info['description'] }}
            </p>
        </div>

        <div class="space-y-6">
            @foreach($endpoints as $index => $endpoint)
                <div class="rounded-xl overflow-hidden shadow-sm transition-all duration-200 glass-card">
                    <!-- Header -->
                    <div 
                        class="flex flex-col md:flex-row md:items-center justify-between p-4 cursor-pointer hover:bg-stone-800/50 transition-colors"
                        onclick="toggleEndpoint({{ $index }})"
                    >
                        <div class="flex items-center gap-4 mb-3 md:mb-0">
                            <span class="px-3 py-1 text-sm font-bold rounded-md min-w-[80px] text-center uppercase tracking-wider method-{{ strtoupper($endpoint['method']) }}">
                                {{ $endpoint['method'] }}
                            </span>
                            <span class="font-mono font-medium text-sm md:text-base break-all text-white">
                                {{ $endpoint['path'] }}
                            </span>
                        </div>
                        <div class="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto">
                            <span class="text-sm font-medium text-stone-400 line-clamp-1 flex-1 md:text-right md:max-w-xs">
                                {{ $endpoint['title'] }}
                            </span>
                            <span id="endpoint-icon-{{ $index }}" class="text-stone-500 flex-shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                            </span>
                        </div>
                    </div>

                    <!-- Body -->
                    <div id="endpoint-body-{{ $index }}" class="p-4 md:p-6 border-t border-stone-800 bg-stone-900/30" style="display: none;">
                        <p class="text-stone-300 mb-6">{{ $endpoint['description'] }}</p>
                        
                        <div class="flex items-center gap-2 mb-8">
                            <span class="text-sm font-semibold uppercase tracking-wider text-stone-500">Authentication:</span>
                            <span class="inline-flex items-center break-all px-2.5 py-0.5 rounded text-xs font-medium bg-primary/20 text-violet-300 border border-primary/30">
                                {{ $endpoint['auth'] }}
                            </span>
                        </div>

                        <div class="grid md:grid-cols-2 gap-8">
                            <!-- Parameters -->
                            <div>
                                <h4 class="text-sm font-bold uppercase tracking-wider text-white mb-3 flex items-center gap-2">
                                    Parameters
                                </h4>
                                @if(count($endpoint['parameters']) === 0)
                                    <div class="text-sm text-stone-500 italic bg-stone-800/20 p-4 rounded-lg border border-stone-800">No parameters required.</div>
                                @else
                                    <div class="rounded-lg border border-stone-800 overflow-hidden">
                                        <table class="w-full text-sm text-left">
                                            <thead class="bg-stone-800 text-stone-300">
                                                <tr>
                                                    <th class="px-4 py-3 font-medium">Name</th>
                                                    <th class="px-4 py-3 font-medium">Type</th>
                                                    <th class="px-4 py-3 font-medium">Description</th>
                                                </tr>
                                            </thead>
                                            <tbody class="divide-y divide-stone-800 bg-stone-900/50">
                                                @foreach($endpoint['parameters'] as $param)
                                                    <tr>
                                                        <td class="px-4 py-3 font-medium text-white">
                                                            {{ $param['name'] }}
                                                            @if($param['required'])
                                                                <span class="ml-1 text-rose-500">*</span>
                                                            @endif
                                                        </td>
                                                        <td class="px-4 py-3 font-mono text-xs text-stone-400">{{ $param['type'] }}</td>
                                                        <td class="px-4 py-3 text-stone-400">{{ $param['description'] }}</td>
                                                    </tr>
                                                @endforeach
                                            </tbody>
                                        </table>
                                    </div>
                                @endif
                            </div>

                            <!-- Response -->
                            <div>
                                <h4 class="text-sm font-bold uppercase tracking-wider text-white mb-3 flex items-center gap-2">
                                    Response Example 
                                    <span class="text-emerald-400 font-mono text-xs ml-2 bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-800/50">
                                        {{ $endpoint['response']['status'] }}
                                    </span>
                                </h4>
                                <div class="bg-black rounded-lg p-4 overflow-x-auto border border-stone-800 shadow-inner">
                                    <pre class="text-xs md:text-sm font-mono text-stone-300"><code>{{ json_encode(json_decode($endpoint['response']['body']), JSON_PRETTY_PRINT) }}</code></pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            @endforeach
        </div>
    </main>
</body>
</html>
