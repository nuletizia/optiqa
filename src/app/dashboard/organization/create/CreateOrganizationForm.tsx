"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function CreateOrganizationForm() {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    setInviteCode(null);

    try {
      const response = await fetch('/api/organization/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create organization');
      }

      setSuccess(true);
      setInviteCode(data.inviteCode.code);
      
      // Clear form
      setName('');
      
      // Refresh router data
      router.refresh();
      
      // Redirect after a short delay to show success message
      setTimeout(() => {
        router.push('/dashboard/organization');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Success!</AlertTitle>
          <AlertDescription className="text-green-700">
            Organization created successfully! You are now an admin.
            {inviteCode && (
              <div className="mt-2">
                <p className="font-medium">Invite Code:</p>
                <code className="bg-green-100 px-2 py-1 rounded">{inviteCode}</code>
                <p className="text-sm mt-1">Share this code with others to invite them to your organization.</p>
              </div>
            )}
            <p className="text-sm mt-2">Redirecting to organization page...</p>
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Organization Name</Label>
          <Input
            id="name"
            placeholder="Enter organization name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isLoading || success}
          />
          <p className="text-sm text-gray-500">
            Choose a unique name for your organization. This will be visible to all members.
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={isLoading || success}>
          {isLoading ? 'Creating...' : 'Create Organization'}
        </Button>
      </form>
    </div>
  );
} 