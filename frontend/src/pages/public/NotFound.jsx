import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Home, ArrowLeft } from 'lucide-react';
import Button from '../../components/ui/Button';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-600 flex items-center justify-center mx-auto shadow-soft-sm">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-extrabold text-ink tracking-tight">404</h1>
        <h2 className="text-xl font-bold text-ink">Page Not Found</h2>
        <p className="text-sm text-muted">
          The requested page or record does not exist or you do not have permission to view it.
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <Link to="/">
            <Button variant="primary" icon={Home}>
              Return Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
