import React, { useState, ChangeEvent, FormEvent, useEffect } from "react";
import Image from "../assets/image.png";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from "@/context/AuthContext";
import { FormData } from "@/interfaces/interfaces";
import { useNavigate } from "react-router-dom";

const RegistrationForm = () => {
  const { register, isApproved } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    phoneNumber: "",
    email: "",
    ssn: "",
    addressLine1: "",
    addressLine2: "",
    password: "",
    confirmPassword: "",
    zipCode: "",
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [passwordStrength, setPasswordStrength] = useState<{
    length: boolean;
    hasSpecialChar: boolean;
    hasNumber: boolean;
    hasUpperCase: boolean;
    hasLowerCase: boolean;
  }>({
    length: false,
    hasSpecialChar: false,
    hasNumber: false,
    hasUpperCase: false,
    hasLowerCase: false,
  });

  useEffect(() => {
    if (isApproved) {
      toast.success('Your registration has been approved. You can now log in.');
      navigate("/login");
    }
  }, [isApproved]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    // Apply formatting for specific fields
    if (name === "ssn") {
      formattedValue = formatSSN(value);
    } else if (name === "phoneNumber") {
      formattedValue = formatPhoneNumber(value);
    } else if (name === "password") {
      checkPasswordStrength(value);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: formattedValue,
    }));

    // Clear error when user starts typing
    setErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  const handleClear = (field: keyof FormData) => {
    setFormData((prev) => ({
      ...prev,
      [field]: "",
    }));

    if (field === "password") {
      setPasswordStrength({
        length: false,
        hasSpecialChar: false,
        hasNumber: false,
        hasUpperCase: false,
        hasLowerCase: false,
      });
    }
  };

  // Format SSN as AAA-GG-SSSS
  const formatSSN = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 5) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else {
      return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
    }
  };

  // Format phone number as (123)-456-7890
  const formatPhoneNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) {
      return digits.length ? `(${digits}` : '';
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)})-${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  // Check password strength
  const checkPasswordStrength = (password: string) => {
    setPasswordStrength({
      length: password.length >= 8 && password.length <= 16,
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      hasNumber: /\d/.test(password),
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
    });
  };

  const validateForm = () => {
    const newErrors: Partial<FormData> = {};
    
    // Required fields
    Object.keys(formData).forEach((key) => {
      if (!formData[key as keyof FormData]) {
        newErrors[key as keyof FormData] = "This field is required";
      }
    });

    // Email validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    // SSN validation
    if (formData.ssn && !/^\d{3}-\d{2}-\d{4}$/.test(formData.ssn)) {
      newErrors.ssn = "SSN must be in format XXX-XX-XXXX";
    }

    // Phone validation
    if (formData.phoneNumber && !/^\(\d{3}\)-\d{3}-\d{4}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = "Phone must be in format (XXX)-XXX-XXXX";
    }

    // Password validation
    if (formData.password) {
      if (formData.password.length < 8 || formData.password.length > 16) {
        newErrors.password = "Password must be 8-16 characters long";
      } else if (!/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/.test(formData.password)) {
        newErrors.password = "Password must include uppercase, lowercase, number, and special character";
      }
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    
    return newErrors;
  };

      const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        
        const newErrors = validateForm();
        
        if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors);
    } else {
          await register(formData, navigate);
        }
      };

      const handleReset = () => {
        setFormData({
          fullName: "",
          phoneNumber: "",
          email: "",
          ssn: "",
          addressLine1: "",
          addressLine2: "",
          password: "",
          confirmPassword: "",
          zipCode: "",
        });
        setErrors({});
        setPasswordStrength({
          length: false,
          hasSpecialChar: false,
          hasNumber: false,
          hasUpperCase: false,
          hasLowerCase: false,
        });
      };

  const handleLoginRedirect = () => {
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="hidden lg:block lg:w-2/5">
        <img src={Image} alt="Registration" className="h-full w-full object-cover" />
      </div>
      
      <div className="w-full lg:w-3/5 px-8 py-12 overflow-y-auto">
        <h1 className="text-3xl font-bold text-green-700 mb-6">Registration Form</h1>
        <hr className="border-t-2 border-green-700 mb-8" />
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name Input */}
            <div className="relative">
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Full Name"
                className="w-full px-6 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-700"
                required
              />
              {formData.fullName && (
                <button
                  type="button"
                  onClick={() => handleClear("fullName")}
                  className="absolute right-3 top-[35%] transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              )}
              {errors.fullName && <p className="mt-1 text-sm text-red-500">{errors.fullName}</p>}
              <p className="mt-1 text-sm text-gray-500">Enter your full name</p>
            </div>

            {/* Phone Number Input */}
            <div className="relative">
              <input
                type="text"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="Phone Number"
                maxLength={14}
                className="w-full px-6 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-700"
              />
              {formData.phoneNumber && (
                <button
                  type="button"
                  onClick={() => handleClear("phoneNumber")}
                  className="absolute right-3 top-[35%] transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              )}
              {errors.phoneNumber && <p className="mt-1 text-sm text-red-500">{errors.phoneNumber}</p>}
              <p className="mt-1 text-sm text-gray-500">Enter your phone number (XXX)-XXX-XXXX</p>
            </div>
          </div>

          {/* Add similar grid patterns for other input pairs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Email Input */}
            <div className="relative">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email"
                className="w-full px-6 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-700"
                required
              />
              {formData.email && (
                <button
                  type="button"
                  onClick={() => handleClear("email")}
                  className="absolute right-3 top-[35%] transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              )}
              {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
              <p className="mt-1 text-sm text-gray-500">Enter your email</p>
            </div>

            {/* SSN Input */}
            <div className="relative">
              <input
                type="text"
                name="ssn"
                value={formData.ssn}
                onChange={handleChange}
                placeholder="SSN"
                maxLength={11}
                className="w-full px-6 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-700"
              />
              {formData.ssn && (
                <button
                  type="button"
                  onClick={() => handleClear("ssn")}
                  className="absolute right-3 top-[35%] transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              )}
              {errors.ssn && <p className="mt-1 text-sm text-red-500">{errors.ssn}</p>}
              <p className="mt-1 text-sm text-gray-500">Enter your SSN (XXX-XX-XXXX format)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Address Line 1 Input */}
            <div className="relative">
              <input
                type="text"
                name="addressLine1"
                value={formData.addressLine1}
                onChange={handleChange}
                placeholder="Address Line 1"
                className="w-full px-6 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-700"
                required
              />
              {formData.addressLine1 && (
                <button
                  type="button"
                  onClick={() => handleClear("addressLine1")}
                  className="absolute right-3 top-[35%] transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              )}
              {errors.addressLine1 && <p className="mt-1 text-sm text-red-500">{errors.addressLine1}</p>}
              <p className="mt-1 text-sm text-gray-500">Enter your address line 1</p>
            </div>

            {/* Address Line 2 Input */}
            <div className="relative">
              <input
                type="text"
                name="addressLine2"
                value={formData.addressLine2}
                onChange={handleChange}
                placeholder="Address Line 2"
                className="w-full px-6 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-700"
                required
              />
              {formData.addressLine2 && (
                <button
                  type="button"
                  onClick={() => handleClear("addressLine2")}
                  className="absolute right-3 top-[35%] transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              )}
              {errors.addressLine2 && <p className="mt-1 text-sm text-red-500">{errors.addressLine2}</p>}
              <p className="mt-1 text-sm text-gray-500">Enter your address line 2</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Password Input */}
            {/* Password Input with Dynamic Validation */}
            <div className="relative">
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Password"
                className={`w-full px-6 py-4 border-2 ${
                  formData.password && Object.values(passwordStrength).every(Boolean)
                    ? "border-green-500"
                    : "border-gray-300"
                } rounded-lg focus:outline-none focus:border-green-700`}
                required
              />
              {formData.password && (
                <button
                  type="button"
                  onClick={() => handleClear("password")}
                  className="absolute right-3 top-[15%] transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              )}
              {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
              
              {/* Dynamic Password Requirements */}
              {formData.password && (
                <div className="mt-1 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Password strength:</span>
                    <div className="flex space-x-1">
                      {Array(5).fill(0).map((_, i) => {
                        const filledBars = Object.values(passwordStrength).filter(Boolean).length;
                        return (
                          <div 
                            key={i} 
                            className={`w-5 h-2 rounded-sm ${
                              i < filledBars 
                                ? filledBars === 5 
                                  ? "bg-green-500" 
                                  : filledBars >= 3 
                                    ? "bg-yellow-500" 
                                    : "bg-red-500"
                                : "bg-gray-300"
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <ul className="ml-2 space-y-1">
                    <li className={`flex items-center ${passwordStrength.length ? "text-green-500" : "text-gray-500"}`}>
                      <span className="mr-2">{passwordStrength.length ? "✓" : "○"}</span>
                      <span>8-16 characters</span>
                    </li>
                    <li className={`flex items-center ${passwordStrength.hasUpperCase ? "text-green-500" : "text-gray-500"}`}>
                      <span className="mr-2">{passwordStrength.hasUpperCase ? "✓" : "○"}</span>
                      <span>At least 1 uppercase letter</span>
                    </li>
                    <li className={`flex items-center ${passwordStrength.hasLowerCase ? "text-green-500" : "text-gray-500"}`}>
                      <span className="mr-2">{passwordStrength.hasLowerCase ? "✓" : "○"}</span>
                      <span>At least 1 lowercase letter</span>
                    </li>
                    <li className={`flex items-center ${passwordStrength.hasNumber ? "text-green-500" : "text-gray-500"}`}>
                      <span className="mr-2">{passwordStrength.hasNumber ? "✓" : "○"}</span>
                      <span>At least 1 number</span>
                    </li>
                    <li className={`flex items-center ${passwordStrength.hasSpecialChar ? "text-green-500" : "text-gray-500"}`}>
                      <span className="mr-2">{passwordStrength.hasSpecialChar ? "✓" : "○"}</span>
                      <span>At least 1 special character (!@#$%^&*)</span>
                    </li>
                  </ul>
                </div>
              )}
              {!formData.password && (
                <p className="mt-1 text-sm text-gray-500">Password must be 8-16 characters with uppercase, lowercase, number, and special character</p>
              )}
            </div>

            {/* Confirm Password Input */}
            <div className="relative">
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm Password"
                className="w-full px-6 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-700"
                required
              />
              {formData.confirmPassword && (
                <button
                  type="button"
                  onClick={() => handleClear("confirmPassword")}
                  className="absolute right-3 top-[15%] transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              )}
              {errors.confirmPassword && <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>}
              <p className="mt-1 text-sm text-gray-500">Confirm your password</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Zip Code Input */}
            <div className="relative">
              <input
                type="text"
                name="zipCode"
                value={formData.zipCode}
                onChange={handleChange}
                placeholder="Zip Code"
                className="w-full px-6 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-700"
                required
              />
              {formData.zipCode && (
                <button
                  type="button"
                  onClick={() => handleClear("zipCode")}
                  className="absolute right-3 top-[18%] transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              )}
              {errors.zipCode && <p className="mt-1 text-sm text-red-500">{errors.zipCode}</p>}
              <p className="mt-1 text-sm text-gray-500">Enter your zip code</p>
            </div>

            <div className="relative">
            <div className="flex justify-around space-x-4 mt-1 col-span-2">
              <button
                type="submit"
                className="px-10 py-3 bg-green-700 text-white rounded-full hover:bg-green-900 transition-colors"
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-10 py-3 border-2 border-green-700 text-green-700 rounded-full hover:bg-green-400 hover:text-white transition-colors"
              >
                Reset
              </button>
            </div>
              <button
                type="button"
                onClick={handleLoginRedirect}
                className="px-10 py-3 border-2 mt-16 border-green-700 text-green-700 rounded-full hover:bg-green-400 hover:text-white transition-colors"
              >
                Already Registered? Login
              </button>
            </div>
          </div>
        </form>
      </div>
      
      <footer className="absolute bottom-0 bg-[#5B9B6B] w-full text-center py-4 border-t">
        <p className="text-white">All Rights Reserved</p>
      </footer>
      <ToastContainer />
    </div>
  );
};

export default RegistrationForm;
