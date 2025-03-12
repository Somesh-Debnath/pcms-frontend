import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import NavigationBar from '../../components/NavigationBar';
import { getUserPlans, updateUserPlanStatus } from '@/services/PlansServices';
import { Plan, Toast, UserPlan } from '@/interfaces/interfaces';

export default function ApproveRequestedPlanPage() {
  const [planRequests, setPlanRequests] = useState<UserPlan[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showApproveModal, setShowApproveModal] = useState(false);
const [showRejectModal, setShowRejectModal] = useState(false);
const [selectedPlan, setSelectedPlan] = useState<UserPlan | null>(null);
const [rejectionComment, setRejectionComment] = useState('');

  useEffect(() => {
    const loadPlanRequests = async () => {
      try {
        const data = await getUserPlans();
        console.log('Data:', data);
        // Filter out plans that are approved or rejected only show new requests
        const requests = data.filter((plan) => plan.status === 'new');
        setPlanRequests(requests);
        console.log('Plan rrequests:', requests);
      } catch (error) {
        console.error('Error loading plan requests:', error);
      }
    };
    loadPlanRequests();
  }, []);

  const addToast = (message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3000);
  };

  const handleApproveClick = (plan: UserPlan) => {
    setSelectedPlan(plan);
    setShowApproveModal(true);
  };
  
  const handleRejectClick = (plan: UserPlan) => {
    setSelectedPlan(plan);
    setShowRejectModal(true);
    setRejectionComment('');
  };
  
  // Update the handleApprove and handleReject functions
  const handleApprove = async (userPlanId: number | undefined) => {
    try {
      console.log('Approving plan:', userPlanId);
      await updateUserPlanStatus(userPlanId, 'approved');
      setPlanRequests((prev) => prev.filter((plan) => plan.userPlanId !== userPlanId));
      addToast('Plan approved successfully');
      setShowApproveModal(false);
      setSelectedPlan(null);
    } catch (error) {
      console.error('Error approving plan:', error);
      addToast('Failed to approve plan');
    }
  };

  const handleReject = async (userPlanId: number | undefined) => {
    try {
      if (!rejectionComment.trim()) {
        addToast('Please provide a rejection reason');
        return;
      }
      await updateUserPlanStatus(userPlanId, 'rejected', rejectionComment);
      setPlanRequests((prev) => prev.filter((plan) => plan.userPlanId !== userPlanId));
      addToast('Plan rejected successfully');
      setShowRejectModal(false);
      setSelectedPlan(null);
      setRejectionComment('');
    } catch (error) {
      console.error('Error rejecting plan:', error);
      addToast('Failed to reject plan');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F5]">
      <NavigationBar />
      <main className="flex-1 p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {planRequests.map((plan) => (
            <div 
              key={plan.userPlanId}
              className="bg-[#E8F5E9] rounded-lg p-6 flex flex-col justify-between h-full"
            >
              <div className="space-y-2">
                <div className="text-gray-700">Location: {plan.location}</div>
                <div className="text-gray-700">Plan name: {plan.planName}</div>
                <div className="text-gray-700">Price: ${plan.price}</div>
                <div className="text-gray-700">Requested by: {plan.requestedBy}</div>
              </div>
              <div className="flex gap-4 mt-4">
                <button
                  onClick={() => handleApproveClick(plan)}
                  className="px-6 py-2 bg-[#5B9B6B] text-white rounded-md hover:bg-[#4A8A5A] transition-colors flex-1"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleRejectClick(plan)}
                  className="px-6 py-2 border border-[#5B9B6B] text-[#5B9B6B] rounded-md hover:bg-gray-50 transition-colors flex-1"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>

        {planRequests.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            No pending plan requests to approve
          </div>
        )}
      </main>

      {showApproveModal && selectedPlan && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h3 className="text-lg font-semibold mb-4">Confirm Approval</h3>
          <p className="text-gray-600 mb-6">
            Are you sure you want to approve this plan request?
          </p>
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Plan: {selectedPlan.planName}</div>
            <div className="text-sm text-gray-600">Location: {selectedPlan.location}</div>
            <div className="text-sm text-gray-600">Requested by: {selectedPlan.requestedBy}</div>
          </div>
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => handleApprove(selectedPlan.userPlanId)}
              className="flex-1 px-4 py-2 bg-[#5B9B6B] text-white rounded-md hover:bg-[#4A8A5A]"
            >
              Confirm
            </button>
            <button
              onClick={() => {
                setShowApproveModal(false);
                setSelectedPlan(null);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

{showRejectModal && selectedPlan && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md">
          <h3 className="text-lg font-semibold mb-4">Confirm Rejection</h3>
          <div className="space-y-2 mb-4">
            <div className="text-sm text-gray-600">Plan: {selectedPlan.planName}</div>
            <div className="text-sm text-gray-600">Location: {selectedPlan.location}</div>
            <div className="text-sm text-gray-600">Requested by: {selectedPlan.requestedBy}</div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Rejection Reason
            </label>
            <textarea
              value={rejectionComment}
              onChange={(e) => setRejectionComment(e.target.value)}
              className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#5B9B6B] focus:border-transparent"
              rows={3}
              placeholder="Please provide a reason for rejection..."
            />
          </div>
          <div className="flex gap-4 mt-6">
            <button
              onClick={() => handleReject(selectedPlan.userPlanId)}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Reject
            </button>
            <button
              onClick={() => {
                setShowRejectModal(false);
                setSelectedPlan(null);
                setRejectionComment('');
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

      <footer className="bg-[#5B9B6B] text-white text-center py-4 mt-8">
        All rights reserved
      </footer>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
          >
            <span>{toast.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-white/80 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}