import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function GitHubCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      exchangeCode(code);
    } else {
      setError('No code provided from GitHub');
    }
  }, [searchParams]);

  const exchangeCode = async (code) => {
    try {
      await api.get(`/github/callback?code=${code}`);
      
      let returnPath = '/settings';
      const savedData = sessionStorage.getItem('gh_auth_return');
      
      if (savedData) {
        try {
          const { path, time } = JSON.parse(savedData);
          // 30 minutes expiration
          if (Date.now() - time < 30 * 60 * 1000) {
            returnPath = path;
          }
        } catch (e) {
          console.error("Failed to parse return path");
        }
        sessionStorage.removeItem('gh_auth_return');
      }

      navigate(`${returnPath}?message=GitHub connected successfully`);
    } catch (err) {
      setError('Failed to connect GitHub: ' + (err.response?.data?.error || 'Unknown error'));
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connecting GitHub</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-10 space-y-4">
          {error ? (
            <>
              <div className="text-destructive font-medium">{error}</div>
              <button 
                onClick={() => navigate('/settings')}
                className="text-primary hover:underline"
              >
                Go back to settings
              </button>
            </>
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Exchanging authorization code...</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
