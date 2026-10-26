import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Key, 
  Cpu, 
  Calendar,
  FileCode
} from 'lucide-react';
import toast from 'react-hot-toast';
import { checkSignature, getVerificationRequestById } from '../../api/verification';

export default function SignaturePanel({
  verificationId,
  signatureCheck: initialCheck,
  signerName,
  panchayatName,
  signedAt,
  payloadJson: initialPayloadJson,
  payloadHash: initialPayloadHash,
  signature: initialSignature,
  signerPublicKey: initialPublicKey,
  fingerprint: initialFingerprint
}) {
  const [checking, setChecking] = useState(false);
  const [currentCheck, setCurrentCheck] = useState(initialCheck);
  const [showTechnical, setShowTechnical] = useState(false);
  const [loadingTechnical, setLoadingTechnical] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const [techData, setTechData] = useState({
    payloadJson: initialPayloadJson,
    payloadHash: initialPayloadHash,
    signature: initialSignature,
    signerPublicKey: initialPublicKey,
    fingerprint: initialFingerprint || initialCheck?.fingerprint
  });

  const isValid = currentCheck ? currentCheck.valid : (initialCheck?.valid ?? true);

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    setCopiedField(fieldName);
    toast.success(`${fieldName} copied to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleVerifyAgain = async () => {
    if (!verificationId) return;
    setChecking(true);
    try {
      const res = await checkSignature(verificationId);
      const checkResult = res.data || res;
      setCurrentCheck(checkResult);
      if (checkResult.valid) {
        toast.success('Signature re-verified: VALID (cryptographic check passed)');
      } else {
        toast.error(`Signature invalid: ${checkResult.reason || 'Verification failed'}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to verify signature');
    } finally {
      setChecking(false);
    }
  };

  const handleToggleTechnical = async () => {
    const nextState = !showTechnical;
    setShowTechnical(nextState);

    // If opening and tech data is missing, fetch from API with technical=1
    if (nextState && (!techData.payloadJson || !techData.signature) && verificationId) {
      setLoadingTechnical(true);
      try {
        const res = await getVerificationRequestById(verificationId, true);
        const data = res.data || res;
        setTechData({
          payloadJson: data.payload_json,
          payloadHash: data.payload_hash,
          signature: data.signature,
          signerPublicKey: data.signer_public_key,
          fingerprint: data.signer_key_fingerprint
        });
        if (data.signature_check) {
          setCurrentCheck(data.signature_check);
        }
      } catch (err) {
        console.error('Failed to load technical details:', err);
      } finally {
        setLoadingTechnical(false);
      }
    }
  };

  const formattedDate = signedAt 
    ? new Date(signedAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Unknown Date';

  const effectiveFingerprint = techData.fingerprint || currentCheck?.fingerprint || 'Not available';
  const displaySigner = signerName || currentCheck?.signer?.name || 'Authorized Officer';
  const displayDesignation = currentCheck?.signer?.designation || 'Officer';
  const displayPanchayat = panchayatName || 'Verifying Panchayat';

  return (
    <div className={`rounded-xl border transition-all ${
      isValid 
        ? 'bg-emerald-50/50 border-emerald-200' 
        : 'bg-red-50/60 border-red-300'
    }`}>
      {/* Top Main Section */}
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className={`p-2.5 rounded-lg flex-shrink-0 ${
              isValid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}>
              {isValid ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                  isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {isValid ? 'DIGITALLY SIGNED & VALID' : 'SIGNATURE INVALID'}
                </span>
                <span className="text-xs text-slate-500">
                  RSA-2048 / SHA-256
                </span>
              </div>

              <h4 className="mt-1 text-sm sm:text-base font-semibold text-slate-900">
                {isValid
                  ? `Digitally signed by ${displaySigner}, ${displayDesignation}, ${displayPanchayat}`
                  : `Signature verification failed: ${currentCheck?.reason || 'Invalid digital signature'}`
                }
              </h4>

              <p className="text-xs text-slate-600 mt-0.5 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400 inline" />
                <span>Signed on {formattedDate}</span>
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2 self-end sm:self-start">
            <button
              onClick={handleVerifyAgain}
              disabled={checking}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition-colors disabled:opacity-50"
              title="Perform real-time cryptographic verification"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>{checking ? 'Verifying...' : 'Verify again'}</span>
            </button>
          </div>
        </div>

        {/* Chips row */}
        <div className="mt-3.5 pt-3 border-t border-slate-200/60 flex flex-wrap items-center gap-2 text-xs">
          {/* Key Fingerprint Chip */}
          <div className="inline-flex items-center bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 shadow-xs">
            <Key className="w-3 h-3 text-slate-400 mr-1.5" />
            <span className="font-mono text-[11px] text-slate-600">
              SHA256: {effectiveFingerprint.slice(0, 8)}...{effectiveFingerprint.slice(-8)}
            </span>
            <button
              onClick={() => handleCopy(effectiveFingerprint, 'Fingerprint')}
              className="ml-1.5 p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
              title="Copy full key fingerprint"
            >
              {copiedField === 'Fingerprint' ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Algorithm chip */}
          <div className="inline-flex items-center bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-700 shadow-xs">
            <Cpu className="w-3 h-3 text-slate-400 mr-1.5" />
            <span>RSA-2048 / SHA-256</span>
          </div>

          {/* Technical Details Toggle */}
          <button
            onClick={handleToggleTechnical}
            className="ml-auto inline-flex items-center space-x-1 text-xs font-medium text-blue-700 hover:text-blue-800 hover:underline cursor-pointer"
          >
            <span>{showTechnical ? 'Hide technical details' : 'Technical details'}</span>
            {showTechnical ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Technical Details Collapsible Drawer */}
      {showTechnical && (
        <div className="border-t border-slate-200 bg-slate-900 text-slate-100 p-4 sm:p-5 rounded-b-xl text-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <FileCode className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-slate-200">Cryptographic Proof & Verification Breakdown</span>
            </div>
            {currentCheck && (
              <span className="text-[11px] text-slate-400">
                Live checks: Hash match ({currentCheck.hashMatches ? '✓' : '✗'}), Signature decrypt ({currentCheck.signatureMatches ? '✓' : '✗'}), Fields intact ({currentCheck.fieldsMatch ? '✓' : '✗'})
              </span>
            )}
          </div>

          {loadingTechnical ? (
            <div className="py-6 text-center text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
              Loading cryptographic payload from server...
            </div>
          ) : (
            <>
              {/* Canonical Payload */}
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="font-medium text-slate-300">1. Canonical Payload (UTF-8 JSON)</span>
                  <button
                    onClick={() => handleCopy(techData.payloadJson, 'Canonical Payload')}
                    className="flex items-center space-x-1 hover:text-slate-100 text-slate-400 text-[11px]"
                  >
                    {copiedField === 'Canonical Payload' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedField === 'Canonical Payload' ? 'Copied' : 'Copy Payload'}</span>
                  </button>
                </div>
                <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto text-[11px] text-emerald-300 font-mono max-h-48 whitespace-pre-wrap break-all">
                  {typeof techData.payloadJson === 'string'
                    ? techData.payloadJson
                    : JSON.stringify(techData.payloadJson, null, 2)}
                </pre>
              </div>

              {/* SHA-256 Payload Hash */}
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="font-medium text-slate-300">2. SHA-256 Hash of Canonical Payload</span>
                  <button
                    onClick={() => handleCopy(techData.payloadHash, 'Payload Hash')}
                    className="flex items-center space-x-1 hover:text-slate-100 text-slate-400 text-[11px]"
                  >
                    {copiedField === 'Payload Hash' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedField === 'Payload Hash' ? 'Copied' : 'Copy Hash'}</span>
                  </button>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-amber-300 break-all">
                  {techData.payloadHash || 'N/A'}
                </div>
              </div>

              {/* Digital Signature (Base64) */}
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="font-medium text-slate-300">3. RSA-2048 Digital Signature (Base64)</span>
                  <button
                    onClick={() => handleCopy(techData.signature, 'Signature')}
                    className="flex items-center space-x-1 hover:text-slate-100 text-slate-400 text-[11px]"
                  >
                    {copiedField === 'Signature' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedField === 'Signature' ? 'Copied' : 'Copy Signature'}</span>
                  </button>
                </div>
                <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-sky-300 max-h-24 overflow-y-auto break-all whitespace-pre-wrap">
                  {techData.signature || 'N/A'}
                </pre>
              </div>

              {/* Signer Public Key */}
              {techData.signerPublicKey && (
                <div>
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="font-medium text-slate-300">4. Signer Public Key (PEM)</span>
                    <button
                      onClick={() => handleCopy(techData.signerPublicKey, 'Public Key')}
                      className="flex items-center space-x-1 hover:text-slate-100 text-slate-400 text-[11px]"
                    >
                      {copiedField === 'Public Key' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedField === 'Public Key' ? 'Copied' : 'Copy Public Key'}</span>
                    </button>
                  </div>
                  <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-400 max-h-28 overflow-y-auto break-all whitespace-pre-wrap">
                    {techData.signerPublicKey}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
