"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { JoinResult } from './page';

interface JoinFormProps {
  joinAction: (formData: FormData) => Promise<JoinResult>;
}

export default function JoinForm({ joinAction }: JoinFormProps) {
  const [errorMessage, setErrorMessage] = useState('');

  return (
    <form action={async (formData) => {
      const result = await joinAction(formData);
      
      if (result.success) {
        // Redirect to organization page on success
        window.location.href = '/dashboard/organization';
        return;
      }
      
      // Handle errors client-side
      if (result.error === 'invalid-code') {
        setErrorMessage('Invalid invite code. Please check and try again.');
      } else if (result.error === 'expired-code') {
        setErrorMessage('This invite code has expired.');
      } else if (result.error === 'usage-limit-reached') {
        setErrorMessage('This invite code has reached its usage limit.');
      } else if (result.error === 'server-error') {
        setErrorMessage('An error occurred. Please try again later.');
      }
    }} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="inviteCode">Organization Invite Code</Label>
          <Input 
            id="inviteCode" 
            name="inviteCode" 
            placeholder="Enter invite code" 
            required 
          />
        </div>
        {errorMessage && (
          <p className="text-sm text-red-600">
            {errorMessage}
          </p>
        )}
        <p className="text-sm text-gray-600">
          Enter the invite code provided by your organization administrator.
        </p>
      </div>
      <Button type="submit" className="w-full">
        Join Organization
      </Button>
    </form>
  );
} 