import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Zap, ArrowLeft, RefreshCw, Upload, Copy, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function PaymentGatewaysPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    gateway_logo_url: '',
    payment_callback_base_url: '',
    bkash_enabled: false,
    bkash_base_url: '',
    bkash_app_key: '',
    bkash_app_secret: '',
    bkash_username: '',
    bkash_password: '',
    bkash_sandbox: true,
    nagad_enabled: false,
    nagad_base_url: '',
    nagad_merchant_id: '',
    nagad_merchant_private_key: '',
    nagad_pg_public_key: '',
    nagad_sandbox: true,
    sslcommerz_enabled: false,
    sslcommerz_base_url: '',
    sslcommerz_store_id: '',
    sslcommerz_store_password: '',
    sslcommerz_sandbox: true,
    ns_default_domain: '',
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      setSettings(prev => ({ ...prev, ...data }));
    } catch (err) {
      toast.error('Failed to load gateway settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => setSettings({ ...settings, [e.target.name]: e.target.value });
  const handleSwitchChange = (name, checked) => setSettings({ ...settings, [name]: checked });

  const fileInputRef = useRef(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    const formData = new FormData();
    formData.append('logo', file);

    try {
      const { data } = await api.post('/settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSettings(prev => ({ ...prev, gateway_logo_url: data.url }));
      toast.success('Logo uploaded successfully');
    } catch (err) {
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const copyUrl = () => {
    if (!settings.gateway_logo_url) return;
    navigator.clipboard.writeText(settings.gateway_logo_url);
    toast.success('Logo URL copied to clipboard');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post('/settings', {
        payment_callback_base_url: settings.payment_callback_base_url,
        bkash_enabled: settings.bkash_enabled,
        bkash_base_url: settings.bkash_base_url,
        bkash_app_key: settings.bkash_app_key,
        bkash_app_secret: settings.bkash_app_secret,
        bkash_username: settings.bkash_username,
        bkash_password: settings.bkash_password,
        bkash_sandbox: settings.bkash_sandbox,
        
        nagad_enabled: settings.nagad_enabled,
        nagad_base_url: settings.nagad_base_url,
        nagad_merchant_id: settings.nagad_merchant_id,
        nagad_merchant_private_key: settings.nagad_merchant_private_key,
        nagad_pg_public_key: settings.nagad_pg_public_key,
        nagad_sandbox: settings.nagad_sandbox,
        
        sslcommerz_enabled: settings.sslcommerz_enabled,
        sslcommerz_base_url: settings.sslcommerz_base_url,
        sslcommerz_store_id: settings.sslcommerz_store_id,
        sslcommerz_store_password: settings.sslcommerz_store_password,
        sslcommerz_sandbox: settings.sslcommerz_sandbox,
      });
      toast.success('Payment gateway settings saved successfully');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/subscription')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Payment Gateways</h2>
            <p className="text-muted-foreground mt-1">Configure credentials for automated plan and credit purchases.</p>
          </div>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSave}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Gateway Configurations
            </CardTitle>
            <CardDescription>
              Any enabled gateway will seamlessly appear as a payment method for your users.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="flex flex-col md:flex-row gap-6 p-4 rounded-xl border bg-muted/10 items-start md:items-center justify-between">
              <div className="space-y-1">
                <h4 className="font-semibold text-base">Brand Logo URL</h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Upload your brand logo starting out to get a public URL. Many payment gateways (like SSL Commerce and Nagad) require this URL during merchant onboarding configuration.
                </p>
                {settings.gateway_logo_url && (
                  <div className="flex items-center gap-2 mt-3 p-1.5 pl-3 border rounded-md bg-background w-full max-w-sm">
                    <span className="text-xs font-mono truncate text-muted-foreground flex-1">
                      {settings.gateway_logo_url}
                    </span>
                    <Button type="button" variant="secondary" size="sm" className="h-7 px-2 shrink-0" onClick={copyUrl}>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy URI
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-3">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleLogoUpload} 
                />
                {settings.gateway_logo_url ? (
                  <div className="h-16 w-32 rounded border bg-background flex items-center justify-center overflow-hidden p-1 shadow-sm">
                    <img src={settings.gateway_logo_url} alt="Brand Logo" className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="h-16 w-32 rounded border border-dashed bg-muted/20 flex flex-col items-center justify-center text-muted-foreground/50">
                    <Upload className="h-4 w-4 mb-1" />
                    <span className="text-[10px]">No Logo</span>
                  </div>
                )}
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  disabled={uploadingLogo} 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Payment Callback Base URL (Optional)</label>
              <div className="flex gap-2">
                <Input 
                  name="payment_callback_base_url" 
                  value={settings.payment_callback_base_url || ''} 
                  onChange={handleChange} 
                  placeholder="e.g. https://panel.yourdomain.com (Defaults to APP_URL)" 
                />
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => setConfirmOpen(true)}
                >
                  <Zap className="h-4 w-4 mr-2 text-yellow-500" />
                  Auto-Setup (payment)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground italic">If your frontend runs on a different URL than the backend, set it here so gateways redirect correctly.</p>
            </div>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Configure Payment Subdomain
                  </DialogTitle>
                  <DialogDescription>
                    This will automatically configure your server for billing callbacks.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                    <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">Summary of automation:</p>
                      <ul className="mt-2 space-y-2 list-disc list-inside text-muted-foreground">
                        <li>Create DNS A record for <span className="font-mono text-primary font-semibold">payment.{(settings.ns_default_domain || "your-domain").replace(/^\.?/, '')}</span></li>
                        <li>Configure Nginx proxy (Port 80/443)</li>
                        <li>Procure SSL certificate via Let's Encrypt</li>
                        <li>Set <span className="font-mono text-primary font-semibold">https://payment.{(settings.ns_default_domain || "your-domain").replace(/^\.?/, '')}</span> as callback base URL</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <DialogFooter className="sm:justify-end gap-2">
                  <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={provisioning}>
                    Cancel
                  </Button>
                  <Button 
                    disabled={provisioning}
                    onClick={async () => {
                      setProvisioning(true);
                      try {
                        toast.loading("Provisioning payment subdomain...", { id: "dns_setup" });
                        const { data } = await api.post('/settings/setup-payment-domain');
                        setSettings(prev => ({ ...prev, payment_callback_base_url: data.url }));
                        toast.success("Domain configured successfully!", { id: "dns_setup" });
                        setConfirmOpen(false);
                      } catch (err) {
                        toast.error(err.response?.data?.message || "Failed to setup payment domain", { id: "dns_setup" });
                      } finally {
                        setProvisioning(false);
                      }
                    }}
                  >
                    {provisioning ? (
                      <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Provisioning...</>
                    ) : (
                      "Confirm & Setup"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-lg flex items-center gap-2 text-[#E2136E]">
                  🔴 bKash API
                </h4>
                <Switch 
                  checked={settings.bkash_enabled} 
                  onCheckedChange={(checked) => handleSwitchChange('bkash_enabled', checked)} 
                />
              </div>
              {settings.bkash_enabled && (
                <div className="grid gap-4 bg-muted/10 p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Sandbox Mode</label>
                    <Switch 
                      checked={settings.bkash_sandbox} 
                      onCheckedChange={(checked) => handleSwitchChange('bkash_sandbox', checked)} 
                    />
                  </div>
                  <Input name="bkash_base_url" value={settings.bkash_base_url || ''} onChange={handleChange} placeholder="Base URL" />
                  <Input name="bkash_app_key" value={settings.bkash_app_key || ''} onChange={handleChange} placeholder="App Key" />
                  <Input name="bkash_app_secret" value={settings.bkash_app_secret || ''} onChange={handleChange} placeholder="App Secret" />
                  <Input name="bkash_username" value={settings.bkash_username || ''} onChange={handleChange} placeholder="Username" />
                  <Input name="bkash_password" value={settings.bkash_password || ''} onChange={handleChange} placeholder="Password" />
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-lg flex items-center gap-2 text-[#F6821F]">
                  🟠 Nagad API
                </h4>
                <Switch 
                  checked={settings.nagad_enabled} 
                  onCheckedChange={(checked) => handleSwitchChange('nagad_enabled', checked)} 
                />
              </div>
              {settings.nagad_enabled && (
                <div className="grid gap-4 bg-muted/10 p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Sandbox Mode</label>
                    <Switch 
                      checked={settings.nagad_sandbox} 
                      onCheckedChange={(checked) => handleSwitchChange('nagad_sandbox', checked)} 
                    />
                  </div>
                  <Input name="nagad_base_url" value={settings.nagad_base_url || ''} onChange={handleChange} placeholder="Base URL" />
                  <Input name="nagad_merchant_id" value={settings.nagad_merchant_id || ''} onChange={handleChange} placeholder="Merchant ID" />
                  <textarea name="nagad_merchant_private_key" value={settings.nagad_merchant_private_key || ''} onChange={handleChange} className="p-3 text-xs font-mono h-24 rounded border bg-background flex w-full" placeholder="Merchant Private Key (PEM format, without headers)" />
                  <textarea name="nagad_pg_public_key" value={settings.nagad_pg_public_key || ''} onChange={handleChange} className="p-3 text-xs font-mono h-24 rounded border bg-background flex w-full" placeholder="PG Public Key (PEM format, without headers)" />
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-lg flex items-center gap-2 text-[#2196F3]">
                  🔵 SSL Commerce
                </h4>
                <Switch 
                  checked={settings.sslcommerz_enabled} 
                  onCheckedChange={(checked) => handleSwitchChange('sslcommerz_enabled', checked)} 
                />
              </div>
              {settings.sslcommerz_enabled && (
                <div className="grid gap-4 bg-muted/10 p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Sandbox Mode</label>
                    <Switch 
                      checked={settings.sslcommerz_sandbox} 
                      onCheckedChange={(checked) => handleSwitchChange('sslcommerz_sandbox', checked)} 
                    />
                  </div>
                  <Input name="sslcommerz_base_url" value={settings.sslcommerz_base_url || ''} onChange={handleChange} placeholder="Base URL" />
                  <Input name="sslcommerz_store_id" value={settings.sslcommerz_store_id || ''} onChange={handleChange} placeholder="Store ID" />
                  <Input name="sslcommerz_store_password" value={settings.sslcommerz_store_password || ''} onChange={handleChange} placeholder="Store Password" />
                </div>
              )}
            </div>

          </CardContent>
          <CardFooter className="flex justify-end border-t pt-6 mt-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
