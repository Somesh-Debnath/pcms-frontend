import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X } from 'lucide-react';
import NavigationBar from '@/components/NavigationBar';
import { User, useAuth } from '@/context/AuthContext';
import { getRegistrations, updateRegistration } from '@/services/CustomerRegistration';
import React from 'react';

export default function ApproveRegistrationsPage() {
  // Remove unused auth variable
  const [registrations, setRegistrations] = useState<User[]>([]);
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationType, setConfirmationType] = useState<'approve' | 'reject'>('approve');
  const [selectedRegistration, setSelectedRegistration] = useState<number | undefined>(undefined);
  const [rejectionComment, setRejectionComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Use refs to track loading states and prevent duplicate API calls
  const loadingRef = useRef(false);
  const processingIdsRef = useRef<Set<number>>(new Set());
  const cachedRegistrationsRef = useRef<Record<string, User[]>>({});
  const lastFetchTimeRef = useRef<number>(0);
  const mountedRef = useRef(false); // Track if component is mounted

  // Prevent setState after unmount
  const safeSetState = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T | ((prev: T) => T)) => {
      if (mountedRef.current) {
        setter(value);
      }
    }, []);
  
  // Cache expiration time (5 minutes)
  const CACHE_TTL = 5 * 60 * 1000;

  // Memoized fetch function to prevent unnecessary re-creation
  const fetchRegistrations = useCallback(async (forceRefresh = false) => {
    // Skip if already loading or cache is fresh (unless forced refresh)
    const now = Date.now();
    if (loadingRef.current || 
        (!forceRefresh && 
         cachedRegistrationsRef.current['all'] && 
         now - lastFetchTimeRef.current < CACHE_TTL)) {
      return;
    }
    
    loadingRef.current = true;
    safeSetState(setIsLoading, true as boolean);
    
    try {
      console.log("📲 Fetching registrations from API");
      const data = await getRegistrations();
      safeSetState(setRegistrations, data);
      
      // Update cache
      cachedRegistrationsRef.current['all'] = data;
      lastFetchTimeRef.current = now;
    } catch (error) {
      addToast('Failed to load registrations');
      console.error('Error loading registrations:', error);
    } finally {
      loadingRef.current = false;
      safeSetState(setIsLoading, false as boolean);
    }
  }, [safeSetState]);

  // Initial load - with empty dependency array to run exactly once
  useEffect(() => {
    mountedRef.current = true;
    
    // Check cache first before API call
    if (cachedRegistrationsRef.current['all'] && 
        Date.now() - lastFetchTimeRef.current < CACHE_TTL) {
      setRegistrations(cachedRegistrationsRef.current['all']);
    } else {
      fetchRegistrations();
    }
    
    return () => {
      mountedRef.current = false;
    };
  }, []); // ⚠️ Intentionally empty - fetch only once on mount

  // Memoized sorted registrations
  const sortedRegistrations = useMemo(() => {
    return [...registrations].sort((a, b) => 
      (a.fullName || '').localeCompare(b.fullName || '')
    );
  }, [registrations]);

  const addToast = useCallback((message: string) => {
    const id = Date.now();
    safeSetState(setToasts, (prev) => [...prev, { id, message }]);
    setTimeout(() => {
      safeSetState(setToasts, (prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  }, [safeSetState]);

  const openConfirmation = useCallback((type: 'approve' | 'reject', id: number | undefined) => {
    safeSetState(setConfirmationType, type);
    safeSetState(setSelectedRegistration, id);
    safeSetState(setRejectionComment, '' as string);
    safeSetState(setCommentError, '' as string);
    safeSetState(setShowConfirmation, true as boolean);
  }, [safeSetState]);

  const closeConfirmation = useCallback(() => {
    safeSetState(setShowConfirmation, false as boolean);
    safeSetState(setSelectedRegistration, undefined);
    safeSetState(setRejectionComment, '' as string);
    safeSetState(setCommentError, '' as string);
  }, [safeSetState]);

  const handleConfirm = useCallback(async () => {
    // Validation for rejection comment
    if (confirmationType === 'reject' && !rejectionComment.trim()) {
      safeSetState(setCommentError, 'Please provide a reason for rejection' as string);
      return;
    }

    // Prevent duplicate processing
    if (!selectedRegistration || processingIdsRef.current.has(selectedRegistration)) {
      return;
    }

    processingIdsRef.current.add(selectedRegistration);
    safeSetState(setIsLoading, true as boolean);

    try {
      console.log(`🔄 Processing registration ${selectedRegistration}: ${confirmationType}`);
      if (confirmationType === 'approve') {
        await updateRegistration(selectedRegistration, "APPROVED");
        // Don't update auth context for every approval - this likely causes rerenders
        // Only set if needed in specific contexts
        addToast('Registration approved successfully');
      } else {
        await updateRegistration(selectedRegistration, "REJECTED", rejectionComment);
        addToast('Registration rejected successfully');
      }
      
      // Optimistically update UI
      safeSetState(setRegistrations, (prev: User[]) => prev.filter((reg: User) => reg.id !== selectedRegistration));
      closeConfirmation();
    } catch (error) {
      addToast(`Failed to ${confirmationType} registration`);
      console.error(`Error ${confirmationType}ing registration:`, error);
    } finally {
      processingIdsRef.current.delete(selectedRegistration);
      safeSetState(setIsLoading, false as boolean);
    }
  }, [selectedRegistration, confirmationType, rejectionComment, addToast, closeConfirmation, safeSetState]);

  const handleApproveAll = useCallback(() => {
    openConfirmation('approve', undefined);
  }, [openConfirmation]);

  const handleRejectAll = useCallback(() => {
    openConfirmation('reject', undefined);
  }, [openConfirmation]);

  const confirmAll = useCallback(async () => {
    if (confirmationType === 'reject' && !rejectionComment.trim()) {
      safeSetState(setCommentError, 'Please provide a reason for rejection' as string);
      return;
    }

    if (registrations.length === 0 || loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    safeSetState(setIsLoading, true as boolean);

    // Create a copy of registrations to prevent race conditions
    const registrationCopy = [...registrations];
    
    try {
      console.log(`🔄 Processing ${registrationCopy.length} registrations in batch`);
      // Limit concurrent API requests to avoid overwhelming the server
      const BATCH_SIZE = 5;
      
      for (let i = 0; i < registrationCopy.length; i += BATCH_SIZE) {
        const batch = registrationCopy.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(registration => {
          return confirmationType === 'approve'
            ? updateRegistration(registration.id!, "APPROVED")
            : updateRegistration(registration.id!, "REJECTED", rejectionComment);
        }));
      }
      
      // Clear the list after successful batch operation
      safeSetState(setRegistrations, [] as User[]);
      addToast(`All registrations ${confirmationType === 'approve' ? 'approved' : 'rejected'} successfully`);
      closeConfirmation();
    } catch (error) {
      addToast(`Failed to ${confirmationType} all registrations`);
      console.error(`Error ${confirmationType}ing all registrations:`, error);
    } finally {
      loadingRef.current = false;
      safeSetState(setIsLoading, false as boolean);
    }
  }, [confirmationType, rejectionComment, registrations, addToast, closeConfirmation, safeSetState]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F5]">
      <NavigationBar />
      <main className="flex-1 p-8">
        {isLoading && registrations.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-700"></div>
          </div>
        ) : (
          <>
            {registrations.length > 0 && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <button 
                    onClick={() => fetchRegistrations(true)}
                    className="px-4 py-2 text-[#5B9B6B] hover:underline flex items-center"
                    disabled={loadingRef.current}
                  >
                    {loadingRef.current ? 'Refreshing...' : 'Refresh list'}
                  </button>
                  <div className="flex gap-4">
                    <button
                      onClick={handleApproveAll}
                      className="px-6 py-2 bg-[#5B9B6B] text-white rounded-md hover:bg-[#4A8A5A] transition-colors"
                      disabled={loadingRef.current}
                    >
                      Approve all
                    </button>
                    <button
                      onClick={handleRejectAll}
                      className="px-6 py-2 border border-[#5B9B6B] text-[#5B9B6B] rounded-md hover:bg-gray-50 transition-colors"
                      disabled={loadingRef.current}
                    >
                      Reject all
                    </button>
                  </div>
                </div>
                <hr className="border-t border-gray-300 my-6" />
              </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {sortedRegistrations.map((registration) => {
                const isProcessing = registration.id !== undefined && processingIdsRef.current.has(registration.id);
                return (
                  <div key={registration.id} className="bg-[#E8F5E9] rounded-lg p-4 space-y-2">
                    <div className="space-y-1">
                      <div className="text-gray-700">Full Name: {registration.fullName}</div>
                      <div className="text-gray-700">Mail Id: {registration.email}</div>
                      <div className="text-gray-700">Mobile number: {registration.phoneNumber}</div>
                      <div className="text-gray-700">Address: {registration.addressLine1}</div>
                      <div className="text-gray-700">Zip code: {registration.zipCode}</div>
                    </div>
                    <div className="flex gap-4 pt-2">
                      <button
                        onClick={() => registration.id && openConfirmation('approve', registration.id)}
                        className="px-6 py-2 bg-[#5B9B6B] text-white rounded-md hover:bg-[#4A8A5A] transition-colors flex-1"
                        disabled={isProcessing || loadingRef.current}
                      >
                        {isProcessing ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => registration.id && openConfirmation('reject', registration.id)}
                        className="px-6 py-2 border border-[#5B9B6B] text-[#5B9B6B] rounded-md hover:bg-gray-50 transition-colors flex-1"
                        disabled={isProcessing || loadingRef.current}
                      >
                        {isProcessing ? 'Processing...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {registrations.length === 0 && !isLoading && (
              <div className="text-center text-gray-500 py-12">No pending registrations to approve</div>
            )}
          </>
        )}
      </main>

      <footer className="bg-[#5B9B6B] text-white text-center py-4 mt-8">All rights reserved</footer>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 space-y-2">
        {toasts.map((toast) => (
          <div key={toast.id} className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <span>{toast.message}</span>
            <button onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))} className="text-white/80 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-semibold mb-4">
              {confirmationType === 'approve' 
                ? `Approve ${selectedRegistration ? 'this' : 'all'} registration${selectedRegistration ? '' : 's'}?` 
                : `Reject ${selectedRegistration ? 'this' : 'all'} registration${selectedRegistration ? '' : 's'}?`}
            </h2>
            
            {confirmationType === 'reject' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionComment}
                  onChange={(e) => {
                    setRejectionComment(e.target.value);
                    if (e.target.value.trim()) setCommentError('');
                  }}
                  className={`w-full border ${commentError ? 'border-red-500' : 'border-gray-300'} rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5B9B6B]`}
                  rows={3}
                  placeholder="Please provide a reason for rejection"
                ></textarea>
                {commentError && <p className="mt-1 text-sm text-red-500">{commentError}</p>}
              </div>
            )}
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeConfirmation}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={selectedRegistration ? handleConfirm : confirmAll}
                className={`px-4 py-2 rounded-md ${
                  confirmationType === 'approve'
                    ? 'bg-[#5B9B6B] text-white hover:bg-[#4A8A5A]'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : `Confirm ${confirmationType === 'approve' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}