import React, { useState, useEffect } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { X, Calendar, Plus, Loader2, Download } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { useAuth, User } from '@/context/AuthContext';
import { getAllPlans, getUserPlans, assignPlanToUser, deleteUserPlan } from '@/services/PlansServices';
import { calculateAndStoreBill, getCumulativeBill } from '@/services/BillService';
import { UserPlan, SubscriptionForm, Plan } from '@/interfaces/interfaces';
import NavigationBar from '@/components/NavigationBar';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Add these constants at the top of your file
const RATE_PER_KWH = 0.12; // Base rate per kilowatt-hour
const DAYS_IN_MONTH = 30; // Standard month length for calculations
const TAX_RATE = 0.08; // 8% tax rate

// Add this interface
interface BillCalculation {
  baseCharge: number;
  usageCharge: number;
  daysInPeriod: number;
  dailyRate: number;
  totalUsage: number;
  taxAmount: number;
  totalAmount: number;
}

export default function PlansPage() {
  const { user } = useAuth();
  console.log('User:', user);
  const [searchLabel, setSearchLabel] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedDate, setSelectedDate] = useState('2023-08-17');
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [filteredPlans, setFilteredPlans] = useState<Plan[]>([]);
  const [isSearchingExisting, setIsSearchingExisting] = useState(false);
  const [loadingPlanId, setLoadingPlanId] = useState<number | null>(null);
  const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionForm>({
    startDate: '2024-10-17',
    endDate: '2024-11-17',
    autoTerminated: false,
    alertRequired: false
  });
  const [subscribingPlan, setSubscribingPlan] = useState<UserPlan | null>(null);
  const [userPlans, setUserPlans] = useState<UserPlan[]>([]);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const plans = await getAllPlans();
        setAllPlans(plans);
      } catch (error) {
        console.error('Error fetching plans:', error);
      }
    };

    fetchPlans();
  }, []);

  useEffect(() => {
    const fetchUserPlans = async () => {
      try {
        const userId = user?.id;
        const plans = await getUserPlans();
        const approvedPlans = plans.filter((plan: UserPlan) => plan.status === 'APPROVED');
        setUserPlans(approvedPlans);
      } catch (error) {
        console.error('Error fetching user plans:', error);
      }
    };

    fetchUserPlans();
  }, [user]);

  const handleSubscribe = async (plan: UserPlan) => {
    setLoadingPlanId(plan.planId ?? null);
    try {
      const userId = user?.id;
      const requestedDate = new Date().toISOString().split('T')[0];
      const { planId, ...rest } = plan as Plan;
      const userPlan: UserPlan = {
        planId: plan.planId!,
        userId: userId!,
        planName: plan.planName,
        price: plan.price,
        location: plan.location,
        requestedBy: user?.fullName,
        requestedDate: requestedDate,
        requiredFrom: subscriptionForm.startDate,
        requiredTo: subscriptionForm.endDate,
        autoTerminated: subscriptionForm.autoTerminated,
        alertRequired: subscriptionForm.alertRequired,
        status: "new",
        plans: [rest]
      };
      await assignPlanToUser(userPlan);
      toast.success('Plan request submitted successfully, awaiting admin approval');
      setIsModalOpen(false);
      setSubscribingPlan(null);
    } catch (error) {
      toast.error('Failed to subscribe to the plan');
    } finally {
      setLoadingPlanId(null);
    }
  };

  const handleUnsubscribe = async (userPlanId: number) => {
    setLoadingPlanId(userPlanId);
    try {
      await deleteUserPlan(userPlanId);
      setUserPlans((prev) => prev.filter((plan) => plan.userPlanId !== userPlanId));
      toast.success('Successfully unsubscribed from the plan');
    } catch (error) {
      toast.error('Failed to unsubscribe from the plan');
    } finally {
      setLoadingPlanId(null);
    }
  };



const handleDownloadBill = async () => {
  try {
    console.log('Generating detailed bill...');
    const doc = new jsPDF();
    const userPlans = await getUserPlans();
    const approvedPlans = userPlans.filter(plan => plan.status === 'APPROVED');
    
    // Document Header
    doc.setFillColor(91, 155, 107);
    doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');
    doc.setTextColor(255);
    doc.setFontSize(24);
    doc.text('Power Consumption Bill', 14, 25);

    // Customer Information
    doc.setTextColor(0);
    doc.setFontSize(12);
    let yPos = 50;
    doc.text(`Customer: ${user?.fullName}`, 14, yPos);
    doc.text(`Bill Date: ${format(new Date(), 'dd/MM/yyyy')}`, 14, yPos + 10);
    
    let totalBillAmount = 0;
    let currentY = 80;

    for (const plan of approvedPlans) {
      const startDate = parseISO(plan.requiredFrom);
      const endDate = parseISO(plan.requiredTo);
      const billData = await calculateAndStoreBill(
        plan.userPlanId!,
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd')
      );

      // Detailed calculations
      const calculation: BillCalculation = {
        daysInPeriod: differenceInDays(endDate, startDate) + 1,
        dailyRate: plan.price / DAYS_IN_MONTH,
        baseCharge: 0,
        usageCharge: 0,
        totalUsage: billData.usageAmount,
        taxAmount: 0,
        totalAmount: 0
      };

      // Calculate charges
      calculation.baseCharge = calculation.dailyRate * calculation.daysInPeriod;
      calculation.usageCharge = calculation.totalUsage * RATE_PER_KWH;
      calculation.taxAmount = (calculation.baseCharge + calculation.usageCharge) * TAX_RATE;
      calculation.totalAmount = calculation.baseCharge + calculation.usageCharge + calculation.taxAmount;

      // Add plan details to PDF
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Plan: ${plan.planName}`, 14, currentY);
      currentY += 10;

      // Add calculation breakdown
      doc.autoTable({
        startY: currentY,
        head: [['Description', 'Calculation', 'Amount']],
        body: [
          ['Billing Period', `${format(startDate, 'dd/MM/yyyy')} to ${format(endDate, 'dd/MM/yyyy')}`, ''],
          ['Number of Days', `${calculation.daysInPeriod} days`, ''],
          ['Monthly Base Rate', `$${plan.price.toFixed(2)}`, ''],
          ['Daily Rate', `$${plan.price.toFixed(2)} ÷ ${DAYS_IN_MONTH}`, `$${calculation.dailyRate.toFixed(2)}`],
          ['Base Charge', `$${calculation.dailyRate.toFixed(2)} × ${calculation.daysInPeriod} days`, `$${calculation.baseCharge.toFixed(2)}`],
          ['Energy Usage', `${calculation.totalUsage.toFixed(2)} kWh`, ''],
          ['Usage Rate', `$${RATE_PER_KWH} per kWh`, ''],
          ['Usage Charge', `${calculation.totalUsage.toFixed(2)} kWh × $${RATE_PER_KWH}`, `$${calculation.usageCharge.toFixed(2)}`],
          ['Subtotal', '', `$${(calculation.baseCharge + calculation.usageCharge).toFixed(2)}`],
          ['Tax (8%)', '', `$${calculation.taxAmount.toFixed(2)}`],
          ['Total for Plan', '', `$${calculation.totalAmount.toFixed(2)}`]
        ],
        styles: { fontSize: 10 },
        headStyles: {
          fillColor: [91, 155, 107],
          textColor: [255, 255, 255]
        },
        columnStyles: {
          0: { fontStyle: 'bold' },
          2: { halign: 'right' }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;
      totalBillAmount += calculation.totalAmount;
    }

    // Add final summary
    doc.setDrawColor(91, 155, 107);
    doc.setLineWidth(1);
    doc.line(14, currentY, 196, currentY);
    currentY += 10;

    doc.autoTable({
      startY: currentY,
      body: [
        ['Total Amount Due', '', `$${totalBillAmount.toFixed(2)}`]
      ],
      styles: { 
        fontSize: 12,
        fontStyle: 'bold'
      },
      theme: 'plain',
      columnStyles: {
        0: { cellWidth: 140 },
        2: { halign: 'right' }
      }
    });

    // Add footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(10);
    doc.setTextColor(128);
    doc.text('This is a computer-generated bill. For questions, please contact support.', 14, pageHeight - 20);
    doc.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, 14, pageHeight - 15);

    // Save the PDF
    const fileName = `power_bill_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
    doc.save(fileName);
    toast.success('Detailed bill generated successfully');
  } catch (error) {
    console.error('Error generating bill:', error);
    toast.error('Failed to generate bill');
  }
};
  
useEffect(() => {
  // Initialize filteredPlans with all plans when component mounts
  setFilteredPlans(allPlans);
}, [allPlans]);

useEffect(() => {
  // Filter plans whenever search inputs change
  const filtered = allPlans.filter(
    (plan) =>
      plan.location?.toLowerCase().includes(searchLabel.toLowerCase()) &&
      (selectedPlan === '' || plan.planName === selectedPlan)
  );
  setFilteredPlans(filtered);
}, [searchLabel, selectedPlan, allPlans]);
  const handleClear = () => {
    setSearchLabel('');
    setSelectedPlan('');
    setSelectedDate('2023-08-17');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F5]">
      <NavigationBar />
      <Toaster/>
      <main className="flex-1 px-8 py-6">
        <h2 className="text-2xl text-[#5B9B6B] mb-4">Search Plans</h2>
        <div className="mb-6">
          <div className='flex justify-between items-center'>
          <div className="inline-flex rounded-md shadow-sm mb-4">
            <button
              className={`px-4 py-2 text-sm font-medium ${
                !isSearchingExisting
                  ? 'bg-[#5B9B6B] text-white'
                  : 'bg-white text-gray-700'
              } rounded-l-lg`}
              onClick={() => setIsSearchingExisting(false)}
            >
              Search new plans
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium ${
                isSearchingExisting
                  ? 'bg-[#5B9B6B] text-white'
                  : 'bg-white text-gray-700'
              } rounded-r-lg`}
              onClick={() => setIsSearchingExisting(true)}
            >
              Search existing plans
            </button>
          </div>
          <button
            className="px-6 py-2 bg-[#5B9B6B] text-white rounded-md
            "
            onClick={handleDownloadBill} 
          >
            <Download className="h-5 w-5 inline-block mr-2" />
            Download Bill
          </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Location</label>
              <div className="relative">
                <input
                  type="text"
                  value={searchLabel}
                  onChange={(e) => setSearchLabel(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 pr-10"
                  placeholder="Input"
                />
                {searchLabel && (
                  <button
                    onClick={() => setSearchLabel('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Plan</label>
              <div className="relative">
                <select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 pr-10"
                >
                  <option value="">Plan</option>
                  {Array.from(new Set(allPlans.map((plan) => plan.planName))).map((planName) => (
                    <option key={planName} value={planName}>
                      {planName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 ml-[20rem]">
              <button className="px-6 py-2 bg-[#5B9B6B] mt-[1.8rem] text-white rounded-md hover:bg-[#4A8A5A] transition-colors flex-1">
                Search
              </button>
              <button
                onClick={handleClear}
                className="px-6 py-2 border mt-[1.8rem] border-[#5B9B6B] text-[#5B9B6B] rounded-md hover:bg-gray-50 transition-colors flex-1"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <h2 className="text-2xl text-[#5B9B6B] mb-4">
          {isSearchingExisting ? 'Existing plans' : 'Available plans'}
        </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isSearchingExisting ? (
            // Show user's existing plans
            userPlans?.map((plan) => (
              <div key={plan.planId} className="bg-[#E8F5E9] rounded-lg p-4 relative">
                <div className="space-y-2">
                  <div>Location: {plan.location}</div>
                  <div>Plan name: {plan.planName}</div>
                  <div>Price: ${plan.price}</div>
                  <button
                    className="px-4 py-2 text-[#5B9B6B] bg-white rounded-md hover:bg-gray-50 transition-colors w-full"
                    onClick={() => handleUnsubscribe(plan.userPlanId!)}
                    disabled={loadingPlanId === plan.planId}
                  >
                    {loadingPlanId === plan.planId ? (
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    ) : (
                      'Unsubscribe'
                    )}
                  </button>
                </div>
              </div>
            ))
          ) : (
            // Show either filtered plans or all plans based on search
            (searchLabel || selectedPlan ? filteredPlans : allPlans).map((plan) => (
              <div key={plan.planId} className="bg-[#E8F5E9] rounded-lg p-4 relative">
                <div className="space-y-2">
                  <div>Location: {plan.location}</div>
                  <div>Plan name: {plan.planName}</div>
                  <div>Price: ${plan.price}</div>
                  <button
                    className="p-2 bg-[#5B9B6B] text-white rounded-full hover:bg-[#4A8A5A] transition-colors absolute bottom-4 right-4"
                    onClick={() => {
                      setSubscribingPlan({
                        ...plan,
                        requiredFrom: subscriptionForm.startDate,
                        requiredTo: subscriptionForm.endDate,
                        autoTerminated: subscriptionForm.autoTerminated,
                        alertRequired: subscriptionForm.alertRequired,
                        userPlanId: 0,
                        userId: user?.id || 0,
                        requestedBy: user?.fullName || '',
                        requestedDate: new Date().toISOString().split('T')[0],
                        status: 'new',
                        plans: [plan]
                      });
                      setIsModalOpen(true);
                    }}
                    disabled={loadingPlanId === plan.planId}
                  >
                    {loadingPlanId === plan.planId ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Plus className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Subscribe Modal */}
      {isModalOpen && subscribingPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Subscribe new plan</h2>
            <div className="space-y-4">
              <div>Location: {subscribingPlan.location}</div>
              <div>Plan name: {subscribingPlan.planName}</div>
              <div>Price: ${subscribingPlan.price}</div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Required from</label>
                <div className="relative">
                  <input
                    type="date"
                    value={subscriptionForm.startDate}
                    onChange={(e) => setSubscriptionForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 pr-10"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none h-5 w-5" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Required to</label>
                <div className="relative">
                  <input
                    type="date"
                    value={subscriptionForm.endDate}
                    onChange={(e) => setSubscriptionForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full border rounded-md px-3 py-2 pr-10"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none h-5 w-5" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={subscriptionForm.autoTerminated}
                    onChange={(e) => setSubscriptionForm(prev => ({ ...prev, autoTerminated: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span>Auto Terminated</span>
                </label>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={subscriptionForm.alertRequired}
                    onChange={(e) => setSubscriptionForm(prev => ({ ...prev, alertRequired: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span>Alert required</span>
                </label>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => handleSubscribe(subscribingPlan)}
                  disabled={loadingPlanId === subscribingPlan.planId}
                  className="px-6 py-2 bg-[#5B9B6B] text-white rounded-md hover:bg-[#4A8A5A] transition-colors flex-1 flex items-center justify-center"
                >
                  {loadingPlanId === subscribingPlan.planId ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Subscribe'
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setSubscribingPlan(null);
                  }}
                  className="px-6 py-2 border border-[#5B9B6B] text-[#5B9B6B] rounded-md hover:bg-gray-50 transition-colors flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-[#5B9B6B] text-white text-center py-4">
        All rights reserved
      </footer>
    </div>
  );
}