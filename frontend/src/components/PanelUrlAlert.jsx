import React, { useState, useEffect } from 'react';
import { X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';

export default function PanelUrlAlert() {
  const [panelUrl, setPanelUrl] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get('/settings');
        if (data.ns_default_domain && data.panel_url && !data.panel_domain_alert_dismissed) {
          // Check if current hostname already matches the panel URL domain
          const currentHostname = window.location.hostname;
          try {
            const recommendedUrl = new URL(data.panel_url);
            if (currentHostname === recommendedUrl.hostname) {
              setLoading(false);
              return; // Already using the domain, don't show alert
            }
          } catch (e) {
            console.error('Invalid panel_url in settings', e);
          }

          setPanelUrl(data.panel_url);
          setIsVisible(true);
        }
      } catch (error) {
        console.error('Failed to fetch settings for panel alert', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleDismiss = async () => {
    try {
      // Optimistically hide the alert
      setIsVisible(false);
      
      // Update the setting in the backend
      await api.post('/settings', {
        panel_domain_alert_dismissed: true,
      });
    } catch (error) {
      console.error('Failed to save panel domain alert status', error);
      // If it fails, we couldn't save, so maybe we show it again, or just let it stay hidden for this session.
    }
  };

  if (!isVisible || loading) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-primary/10 border-t border-primary/20 p-3 sm:p-4 animate-in slide-in-from-bottom duration-300">
      <div className="flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-primary/20 p-2 rounded-full hidden sm:block">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Control Panel URL Available</p>
            <p className="text text-muted-foreground mt-0.5">
              For the best experience, please use the domain-based control panel URL: <a href={panelUrl} className="font-semibold text-primary hover:underline">{panelUrl}</a>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleDismiss} size="sm" variant="default" className="w-full sm:w-auto">
            Ok, I understand
          </Button>
        </div>
      </div>
    </div>
  );
}
