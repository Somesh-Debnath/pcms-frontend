import React, { useState, useEffect } from "react";
import {
  format,
  parseISO,
  differenceInDays,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Pie,
  PieChart,
  Cell
} from "recharts";
import { X, Calendar, Plus, Loader2, Download, BarChart2 } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import { useAuth, User } from "@/context/AuthContext";
import {
  getAllPlans,
  getUserPlans,
  assignPlanToUser,
  deleteUserPlan,
} from "@/services/PlansServices";
import {
  calculateAndStoreBill,
  getCumulativeBill,
} from "@/services/BillService";
import { UserPlan, SubscriptionForm, Plan } from "@/interfaces/interfaces";
import NavigationBar from "@/components/NavigationBar";
import jsPDF from "jspdf";
import "jspdf-autotable";

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
  console.log("User:", user);
  const [searchLabel, setSearchLabel] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("");
  const [selectedDate, setSelectedDate] = useState("2023-08-17");
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [filteredPlans, setFilteredPlans] = useState<Plan[]>([]);
  const [isSearchingExisting, setIsSearchingExisting] = useState(false);
  const [loadingPlanId, setLoadingPlanId] = useState<number | null>(null);
  const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionForm>({
    startDate: "2024-10-17",
    endDate: "2024-11-17",
    autoTerminated: false,
    alertRequired: false,
  });
  const [subscribingPlan, setSubscribingPlan] = useState<UserPlan | null>(null);
  const [userPlans, setUserPlans] = useState<UserPlan[]>([]);
  // Update the state declaration
  const [showBillMenu, setShowBillMenu] = useState<string | number | null>(
    null
  );
  const [showCustomRange, setShowCustomRange] = useState<number | "all" | null>(
    null
  );
  const [customDateRange, setCustomDateRange] = useState({
    start: format(new Date(), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [usageData, setUsageData] = useState<
    Array<{
      name: string;
      dailyUsage: number;
      totalAmount: number;
    }>
  >([]);
  const [isSearchingRejected, setIsSearchingRejected] = useState(false);
  const [rejectedPlans, setRejectedPlans] = useState<UserPlan[]>([]);
  const [showUnsubscribeModal, setShowUnsubscribeModal] = useState(false);
  const [unsubscribingPlan, setUnsubscribingPlan] = useState<UserPlan | null>(null);


  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const plans = await getAllPlans();
        setAllPlans(plans);
      } catch (error) {
        console.error("Error fetching plans:", error);
      }
    };

    fetchPlans();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showBillMenu &&
        !(event.target as Element).closest(".bill-menu-container")
      ) {
        setShowBillMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showBillMenu]);

  useEffect(() => {
    const fetchUserPlans = async () => {
      try {
        const plans = await getUserPlans();
        const approvedPlans = plans.filter((plan: UserPlan) => plan.status === "APPROVED");
        const rejectedPlans = plans.filter((plan: UserPlan) => plan.status === "REJECTED");
        setUserPlans(approvedPlans);
        setRejectedPlans(rejectedPlans);
      } catch (error) {
        console.error("Error fetching user plans:", error);
      }
    };

    fetchUserPlans();
  }, [user]);

  const handleSubscribe = async (plan: UserPlan) => {
    setLoadingPlanId(plan.planId ?? null);
    try {
      const userId = user?.id;
      const requestedDate = new Date().toISOString().split("T")[0];
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
        plans: [rest],
      };
      await assignPlanToUser(userPlan);
      toast.success(
        "Plan request submitted successfully, awaiting admin approval"
      );
      setIsModalOpen(false);
      setSubscribingPlan(null);
    } catch (error) {
      toast.error("Failed to subscribe to the plan");
    } finally {
      setLoadingPlanId(null);
    }
  };

  const handleUnsubscribeClick = (plan: UserPlan) => {
    setUnsubscribingPlan(plan);
    setShowUnsubscribeModal(true);
  };

  const handleUnsubscribe = async (userPlanId: number) => {
    setLoadingPlanId(userPlanId);
    try {
      await deleteUserPlan(userPlanId);
      setUserPlans((prev) =>
        prev.filter((plan) => plan.userPlanId !== userPlanId)
      );
      toast.success("Successfully unsubscribed from the plan");
      setShowUnsubscribeModal(false);
      setUnsubscribingPlan(null);
    } catch (error) {
      toast.error("Failed to unsubscribe from the plan");
    } finally {
      setLoadingPlanId(null);
    }
  };


  const calculateBill = (
    price: number,
    startDate: Date,
    endDate: Date
  ): number => {
    try {
      // Ensure end date is not before start date
      if (endDate < startDate) {
        throw new Error("End date cannot be before start date");
      }

      // Calculate number of days including both start and end dates
      const days = differenceInDays(endDate, startDate) + 1;

      // Calculate total amount (price per day * number of days)
      const totalAmount = price * days;

      // Return rounded to 2 decimal places
      return Number(totalAmount.toFixed(2));
    } catch (error) {
      console.error("Error calculating bill:", error);
      throw error;
    }
  };

  const handleDownloadBill = async (
    plan: UserPlan,
    type: "current" | "previous" | "custom" = "current",
    customStart?: string,
    customEnd?: string
  ) => {
    try {
      let startDate: Date;
      let endDate: Date;

      // Determine the date range based on type
      switch (type) {
        case "current":
          startDate = startOfMonth(new Date());
          endDate = new Date();
          break;
        case "previous":
          const previousMonth = subMonths(new Date(), 1);
          startDate = startOfMonth(previousMonth);
          endDate = endOfMonth(previousMonth);
          break;
        case "custom":
          if (!customStart || !customEnd) {
            throw new Error("Custom date range required");
          }
          startDate = parseISO(customStart);
          endDate = parseISO(customEnd);
          break;
        default:
          startDate = new Date();
          endDate = new Date();
      }

      const doc = new jsPDF();
      let yPos = 50;

      // If it's a consolidated bill, generate separate sections for each plan
      if (plan.planName === "Consolidated Plans") {
        // Header
        doc.setFillColor(91, 155, 107);
        doc.rect(0, 0, doc.internal.pageSize.width, 40, "F");
        doc.setTextColor(255);
        doc.setFontSize(24);
        doc.text("Power Consumption Bills", 14, 25);

        // Customer Details
        doc.setTextColor(0);
        doc.setFontSize(12);
        doc.text(`Customer: ${user?.fullName}`, 14, yPos);
        doc.text(
          `Bill Period: ${format(startDate, "dd/MM/yyyy")} to ${format(
            endDate,
            "dd/MM/yyyy"
          )}`,
          14,
          yPos + 10
        );

        yPos += 30;

        // Generate section for each plan
        for (const userPlan of userPlans) {
          const days = differenceInDays(endDate, startDate) + 1;
          const planTotal = calculateBill(userPlan.price, startDate, endDate);

          // Plan header
          doc.setFontSize(14);
          doc.setTextColor(91, 155, 107);
          doc.text(`Plan: ${userPlan.planName}`, 14, yPos);
          doc.setTextColor(0);
          doc.setFontSize(12);
          doc.text(`Location: ${userPlan.location}`, 14, yPos + 10);

          // Plan calculation table
          doc.autoTable({
            startY: yPos + 20,
            head: [["Description", "Details", "Amount"]],
            body: [
              [
                "Daily Rate",
                `$${userPlan.price.toFixed(2)}`,
                `$${userPlan.price.toFixed(2)}`,
              ],
              [
                "Number of Days",
                `${days} days`,
                `$${(userPlan.price * days).toFixed(2)}`,
              ],
              ["Total Amount", "", `$${planTotal.toFixed(2)}`],
            ],
            styles: {
              fontSize: 10,
              cellPadding: 5,
            },
            headStyles: {
              fillColor: [91, 155, 107],
              textColor: [255, 255, 255],
              halign: "left",
            },
            columnStyles: {
              0: { fontStyle: "bold" },
              1: { halign: "left" },
              2: { halign: "right" },
            },
            theme: "grid",
            margin: { left: 14 },
          });

          // Update Y position for next plan
          yPos = (doc as any).lastAutoTable.finalY + 30;

          // Add new page if needed
          if (
            yPos > doc.internal.pageSize.height - 60 &&
            userPlans.indexOf(userPlan) !== userPlans.length - 1
          ) {
            doc.addPage();
            yPos = 20;
          }
        }
      } else {
        // Single plan bill generation
        const days = differenceInDays(endDate, startDate) + 1;
        const totalAmount = calculateBill(plan.price, startDate, endDate);

        // Header
        doc.setFillColor(91, 155, 107);
        doc.rect(0, 0, doc.internal.pageSize.width, 40, "F");
        doc.setTextColor(255);
        doc.setFontSize(24);
        doc.text("Power Consumption Bill", 14, 25);

        // Bill Details
        doc.setTextColor(0);
        doc.setFontSize(12);
        doc.text(`Customer: ${user?.fullName}`, 14, yPos);
        doc.text(`Plan: ${plan.planName}`, 14, yPos + 10);
        doc.text(`Location: ${plan.location}`, 14, yPos + 20);
        doc.text(
          `Bill Period: ${format(startDate, "dd/MM/yyyy")} to ${format(
            endDate,
            "dd/MM/yyyy"
          )}`,
          14,
          yPos + 30
        );

        // Calculation Table
        doc.autoTable({
          startY: yPos + 40,
          head: [["Description", "Details", "Amount"]],
          body: [
            [
              "Daily Rate",
              `$${plan.price.toFixed(2)}`,
              `$${plan.price.toFixed(2)}`,
            ],
            [
              "Number of Days",
              `${days} days`,
              `$${(plan.price * days).toFixed(2)}`,
            ],
            ["Total Amount", "", `$${totalAmount.toFixed(2)}`],
          ],
          styles: {
            fontSize: 10,
            cellPadding: 5,
          },
          headStyles: {
            fillColor: [91, 155, 107],
            textColor: [255, 255, 255],
            halign: "left",
          },
          columnStyles: {
            0: { fontStyle: "bold" },
            1: { halign: "left" },
            2: { halign: "right" },
          },
          theme: "grid",
          margin: { left: 14 },
        });
      }

      // Footer
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(10);
      doc.setTextColor(128);
      doc.text("This is a computer-generated bill.", 14, pageHeight - 20);
      doc.text(
        `Generated on ${format(new Date(), "dd/MM/yyyy HH:mm:ss")}`,
        14,
        pageHeight - 15
      );

      // Save the PDF
      const fileName =
        plan.planName === "Consolidated Plans"
          ? `power_bills_all_plans_${format(new Date(), "yyyyMMdd_HHmmss")}.pdf`
          : `power_bill_${plan.planName}_${format(
            new Date(),
            "yyyyMMdd_HHmmss"
          )}.pdf`;
      doc.save(fileName);
      toast.success("Bill generated successfully");
    } catch (error) {
      console.error("Error generating bill:", error);
      toast.error("Failed to generate bill");
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
        (selectedPlan === "" || plan.planName === selectedPlan)
    );
    setFilteredPlans(filtered);
  }, [searchLabel, selectedPlan, allPlans]);
  const handleClear = () => {
    setSearchLabel("");
    setSelectedPlan("");
    setSelectedDate("2023-08-17");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F5]">
      <NavigationBar />
      <Toaster />
      <main className="flex-1 px-8 py-6">
        <h2 className="text-2xl text-[#5B9B6B] mb-4">Search Plans</h2>
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div className="inline-flex rounded-md shadow-sm mb-4">
              <button
                className={`px-4 py-2 text-sm font-medium ${!isSearchingExisting && !isSearchingRejected
                  ? "bg-[#5B9B6B] text-white"
                  : "bg-white text-gray-700"
                  } rounded-l-lg`}
                onClick={() => {
                  setIsSearchingExisting(false);
                  setIsSearchingRejected(false);
                }}
              >
                Search new plans
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${isSearchingExisting && !isSearchingRejected
                  ? "bg-[#5B9B6B] text-white"
                  : "bg-white text-gray-700"
                  }`}
                onClick={() => {
                  setIsSearchingExisting(true);
                  setIsSearchingRejected(false);
                }}
              >
                Search existing plans
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${isSearchingRejected
                  ? "bg-[#FF6B6B] text-white"
                  : "bg-white text-gray-700"
                  } rounded-r-lg`}
                onClick={() => {
                  setIsSearchingExisting(false);
                  setIsSearchingRejected(true);
                }}
              >
                Rejected plans
              </button>
            </div>

            <div className="flex justify-between items-center">
              <button
                className="px-6 py-2 bg-[#5B9B6B] mx-3 text-white rounded-md hover:bg-[#4A8A5A] transition-colors flex items-center"
                onClick={() => {
                  const data = userPlans.map((plan) => ({
                    name: plan.planName,
                    dailyUsage: plan.price,
                    totalAmount: calculateBill(
                      plan.price,
                      startOfMonth(new Date()),
                      new Date()
                    ),
                  }));
                  setUsageData(data);
                  setShowInsightsModal(true);
                }}
              >
                <BarChart2 className="h-5 w-5 inline-block mr-2" />
                Power Usage Insights
              </button>

              <div className="relative bill-menu-container">
                <button
                  className="px-6 py-2 bg-[#5B9B6B] text-white rounded-md hover:bg-[#4A8A5A] transition-colors flex items-center"
                  onMouseEnter={() => setShowBillMenu("all")}
                >
                  <Download className="h-5 w-5 inline-block mr-2" />
                  Download Bill
                </button>
                {showBillMenu === "all" && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-10">
                    <div className="py-1">
                      <div className="px-4 py-2 text-sm font-medium text-gray-700 border-b">
                        All Plans Bill
                      </div>
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          if (userPlans.length > 0) {
                            const consolidatedPlan = {
                              ...userPlans[0],
                              planName: "Consolidated Plans",
                              location: userPlans.map((p) => p.location).join(", "),
                              price: userPlans.reduce((sum, plan) => sum + plan.price, 0)
                            };
                            try {
                              await handleDownloadBill(consolidatedPlan, "current");
                              setShowBillMenu(null);
                            } catch (error) {
                              console.error("Error downloading bill:", error);
                              toast.error("Failed to download bill");
                            }
                          } else {
                            toast.error("No plans available");
                          }
                        }}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Current Month (All Plans)
                      </button>
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          if (userPlans.length > 0) {
                            const consolidatedPlan = {
                              ...userPlans[0],
                              planName: "Consolidated Plans",
                              location: userPlans.map((p) => p.location).join(", "),
                              price: userPlans.reduce((sum, plan) => sum + plan.price, 0)
                            };
                            try {
                              await handleDownloadBill(consolidatedPlan, "previous");
                              setShowBillMenu(null);
                            } catch (error) {
                              console.error("Error downloading bill:", error);
                              toast.error("Failed to download bill");
                            }
                          } else {
                            toast.error("No plans available");
                          }
                        }}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Previous Month (All Plans)
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setShowCustomRange("all");
                          setShowBillMenu(null);
                        }}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Custom Range (All Plans)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Location
              </label>
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
                    onClick={() => setSearchLabel("")}
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
                  {Array.from(
                    new Set(allPlans.map((plan) => plan.planName))
                  ).map((planName) => (
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

        <h2 className={`text-2xl mb-4 ${isSearchingRejected ? "text-[#FF6B6B]" : "text-[#5B9B6B]"
          }`}>
          {isSearchingRejected
            ? "Rejected plans"
            : isSearchingExisting
              ? "Existing plans"
              : "Available plans"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isSearchingRejected ? (
            // Show Rejected Plans
            rejectedPlans.length > 0 ? (
              rejectedPlans.filter(plan => plan.status === "REJECTED").map((plan) => (
                <div
                  key={plan.userPlanId}
                  className="bg-[#FFE8E8] rounded-lg p-4 relative border border-[#FF6B6B]"
                >
                  <div className="space-y-2">
                    <div className="font-medium text-gray-900">
                      Plan name: {plan.planName}
                    </div>
                    <div className="text-sm text-gray-600">
                      Location: {plan.location}
                    </div>
                    <div className="text-sm text-gray-600">
                      Price: ${plan.price}
                    </div>
                    <div className="mt-4 p-3 bg-red-50 rounded-md">
                      <div className="text-sm font-medium text-red-800">
                        Request Details
                      </div>
                      <div className="text-sm text-red-600 mt-1">
                        Requested By: {plan.requestedBy}
                      </div>
                      <div className="text-sm text-red-600">
                        Requested Date: {format(new Date(plan.requestedDate), 'dd MMM yyyy')}
                      </div>
                      <div className="text-sm text-red-600">
                        Required Period: {format(new Date(plan.requiredFrom), 'dd MMM yyyy')} -
                        {format(new Date(plan.requiredTo), 'dd MMM yyyy')}
                      </div>

                      <div className="text-sm text-red-600">
                        Rejection Reason: {plan.rejectionComment}
                      </div>

                    </div>
                    <button
                      onClick={() => {
                        setRejectedPlans(prev =>
                          prev.filter(rp => rp.userPlanId !== plan.userPlanId)
                        );
                        toast.success("Plan removed from rejected list");
                      }}
                      className="w-full mt-4 px-4 py-2 text-sm text-red-600 bg-white rounded-md hover:bg-red-50 transition-colors border border-red-200"
                    >
                      Remove from list
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-8 text-gray-500">
                No rejected plans found
              </div>
            )
          ) : isSearchingExisting ? (
            // Show Existing/Approved Plans
            userPlans.filter(plan => plan.status === "APPROVED").map((plan) => (
              <div
                key={plan.userPlanId}
                className="bg-[#E8F5E9] rounded-lg p-4 relative"
              >
                <div className="space-y-2">
                  <div className="font-medium text-gray-900">Plan name: {plan.planName}</div>
                  <div className="text-sm text-gray-600">Location: {plan.location}</div>
                  <div className="text-sm text-gray-600">Price: ${plan.price}</div>
                  <div className="text-sm text-gray-600">
                    Period: {format(new Date(plan.requiredFrom), 'dd MMM yyyy')} -
                    {format(new Date(plan.requiredTo), 'dd MMM yyyy')}
                  </div>
                  <div className="text-sm text-gray-600">
                    Auto Termination: {plan.autoTerminated ? 'Yes' : 'No'}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      className="flex-1 px-4 py-2 text-[#5B9B6B] bg-white rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center"
                      onClick={() => handleUnsubscribeClick(plan)}
                      disabled={loadingPlanId === plan.planId}
                    >
                      {loadingPlanId === plan.planId ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        "Unsubscribe"
                      )}
                    </button>
                    <div className="relative bill-menu-container">
                      <button
                        onClick={() => setShowBillMenu(plan.userPlanId)}
                        className="px-4 py-2 text-[#5B9B6B] bg-white rounded-md hover:bg-gray-50 transition-colors flex items-center"
                      >
                        <Download className="h-5 w-5 mr-2" />
                        Download Bill
                      </button>
                      {/* ... existing bill menu code ... */}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            // Show Available Plans (New Plans)
            (searchLabel || selectedPlan ? filteredPlans : allPlans).map((plan) => (
              <div
                key={plan.planId}
                className="bg-[#E8F5E9] rounded-lg p-4 relative"
              >
                <div className="space-y-2">
                  <div className="font-medium text-gray-900">Plan name: {plan.planName}</div>
                  <div className="text-sm text-gray-600">Location: {plan.location}</div>
                  <div className="text-sm text-gray-600">Price: ${plan.price}</div>
                  {plan.description && (
                    <div className="text-sm text-gray-600">Description: {plan.description}</div>
                  )}
                  <button
                    className="p-2 bg-[#5B9B6B] text-white rounded-full hover:bg-[#4A8A5A] transition-colors absolute bottom-4 right-4"
                    onClick={() => {
                      setSubscribingPlan({
                        ...plan,
                        userPlanId: 0,
                        userId: user?.id || 0,
                        requestedBy: user?.fullName || "",
                        requestedDate: new Date().toISOString().split("T")[0],
                        requiredFrom: subscriptionForm.startDate,
                        requiredTo: subscriptionForm.endDate,
                        autoTerminated: subscriptionForm.autoTerminated,
                        alertRequired: subscriptionForm.alertRequired,
                        status: "new",
                        plans: []
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
                <label className="text-sm font-medium text-gray-700">
                  Required from
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={subscriptionForm.startDate}
                    onChange={(e) =>
                      setSubscriptionForm((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className="w-full border rounded-md px-3 py-2 pr-10"
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none h-5 w-5" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Required to
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={subscriptionForm.endDate}
                    onChange={(e) =>
                      setSubscriptionForm((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
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
                    onChange={(e) =>
                      setSubscriptionForm((prev) => ({
                        ...prev,
                        autoTerminated: e.target.checked,
                      }))
                    }
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
                    onChange={(e) =>
                      setSubscriptionForm((prev) => ({
                        ...prev,
                        alertRequired: e.target.checked,
                      }))
                    }
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
                    "Subscribe"
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

      {showCustomRange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Select Date Range</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) =>
                    setCustomDateRange((prev) => ({
                      ...prev,
                      start: e.target.value,
                    }))
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  End Date
                </label>
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) =>
                    setCustomDateRange((prev) => ({
                      ...prev,
                      end: e.target.value,
                    }))
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    handleDownloadBill(
                      userPlans.find((p) => p.userPlanId === showCustomRange)!,
                      "custom",
                      customDateRange.start,
                      customDateRange.end
                    );
                    setShowCustomRange(null);
                  }}
                  className="flex-1 bg-[#5B9B6B] text-white rounded-md py-2 hover:bg-[#4A8A5A]"
                >
                  Download
                </button>
                <button
                  onClick={() => setShowCustomRange(null)}
                  className="flex-1 border border-gray-300 rounded-md py-2 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInsightsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-semibold text-[#5B9B6B]">Power Usage Analytics</h3>
                <p className="text-sm text-gray-500">Comprehensive view of your power consumption</p>
              </div>
              <button
                onClick={() => setShowInsightsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-8">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-[#5B9B6B] to-[#4A8A5A] p-4 rounded-lg shadow-sm text-white">
                  <h5 className="text-sm opacity-80 mb-2">Total Monthly Cost</h5>
                  <p className="text-3xl font-semibold">
                    ${usageData.reduce((sum, plan) => sum + plan.totalAmount, 0).toFixed(2)}
                  </p>
                  <p className="text-xs mt-2 opacity-80">Across all active plans</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                  <h5 className="text-sm text-gray-500 mb-2">Active Plans</h5>
                  <p className="text-3xl font-semibold text-[#5B9B6B]">{usageData.length}</p>
                  <p className="text-xs mt-2 text-gray-500">Currently subscribed</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                  <h5 className="text-sm text-gray-500 mb-2">Average Daily Rate</h5>
                  <p className="text-3xl font-semibold text-[#5B9B6B]">
                    ${(usageData.reduce((sum, plan) => sum + plan.dailyUsage, 0) / Math.max(1, usageData.length)).toFixed(2)}
                  </p>
                  <p className="text-xs mt-2 text-gray-500">Per plan average</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                  <h5 className="text-sm text-gray-500 mb-2">Projected Annual Cost</h5>
                  <p className="text-3xl font-semibold text-[#5B9B6B]">
                    ${(usageData.reduce((sum, plan) => sum + plan.totalAmount, 0) * 12).toFixed(2)}
                  </p>
                  <p className="text-xs mt-2 text-gray-500">Based on current usage</p>
                </div>
              </div>

              {/* Monthly Comparison Chart */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <h4 className="text-lg font-medium mb-6">Monthly Cost by Plan</h4>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={usageData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                          }}
                        />
                        <Legend />
                        <Bar
                          dataKey="totalAmount"
                          name="Monthly Cost"
                          fill="#5B9B6B"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="dailyUsage"
                          name="Daily Rate"
                          fill="#82ca9d"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Cost Distribution Pie Chart */}
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <h4 className="text-lg font-medium mb-6">Cost Distribution</h4>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={usageData}
                          dataKey="totalAmount"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={120}
                          paddingAngle={2}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {usageData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={[
                                '#5B9B6B',
                                '#82ca9d',
                                '#4A8A5A',
                                '#3E7248',
                                '#6BAD7B'
                              ][index % 5]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
                          contentStyle={{
                            backgroundColor: '#fff',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Detailed Summary Table */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <h4 className="text-lg font-medium mb-4">Detailed Cost Analysis</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Plan Details
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Daily Rate
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Monthly Total
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          % of Total Cost
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Yearly Projection
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {usageData.map((plan, index) => {
                        const totalCost = usageData.reduce((sum, p) => sum + p.totalAmount, 0);
                        const percentage = (plan.totalAmount / totalCost) * 100;
                        return (
                          <tr key={plan.name} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">{plan.name}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">
                                ${plan.dailyUsage.toFixed(2)}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">
                                ${plan.totalAmount.toFixed(2)}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="w-16 text-sm text-gray-900">
                                  {percentage.toFixed(1)}%
                                </div>
                                <div className="flex-1 h-2 bg-gray-200 rounded-full">
                                  <div
                                    className="h-full bg-[#5B9B6B] rounded-full"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">
                                ${(plan.totalAmount * 12).toFixed(2)}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

{showUnsubscribeModal && unsubscribingPlan && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-full max-w-md">
      <h3 className="text-lg font-semibold mb-4">Confirm Unsubscribe</h3>
      <div className="space-y-4">
        <p className="text-gray-600">
          Are you sure you want to unsubscribe from this plan?
        </p>
        <div className="space-y-2">
          <div className="text-sm text-gray-600">
            Plan: {unsubscribingPlan.planName}
          </div>
          <div className="text-sm text-gray-600">
            Location: {unsubscribingPlan.location}
          </div>
          <div className="text-sm text-gray-600">
            Price: ${unsubscribingPlan.price}
          </div>
          <div className="text-sm text-gray-600">
            Period: {format(new Date(unsubscribingPlan.requiredFrom), 'dd MMM yyyy')} - 
            {format(new Date(unsubscribingPlan.requiredTo), 'dd MMM yyyy')}
          </div>
        </div>
        <div className="flex gap-4 mt-6">
          <button
            onClick={() => handleUnsubscribe(unsubscribingPlan.userPlanId)}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            disabled={loadingPlanId === unsubscribingPlan.userPlanId}
          >
            {loadingPlanId === unsubscribingPlan.userPlanId ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            ) : (
              "Confirm Unsubscribe"
            )}
          </button>
          <button
            onClick={() => {
              setShowUnsubscribeModal(false);
              setUnsubscribingPlan(null);
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
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
