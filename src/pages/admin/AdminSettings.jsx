import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { adminService } from '../../services/allServices'
import AdminLayout from '../../components/layout/AdminLayout'
import { FiUser, FiMail, FiShield, FiLock, FiSave, FiBriefcase, FiEye, FiEyeOff, FiSliders } from 'react-icons/fi'

const TABS = [
  { key: 'profile',  label: 'Profile',           icon: FiUser      },
  { key: 'business', label: 'Business Settings',  icon: FiBriefcase },
  { key: 'policies', label: 'Pricing & Policies', icon: FiSliders   },
  { key: 'security', label: 'Security',           icon: FiShield    },
]

export default function AdminSettings() {
  const { user, updateUser } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(true)

  const profileForm = useForm()
  const [savingProfile, setSavingProfile] = useState(false)

  const businessForm = useForm()
  const [savingBusiness, setSavingBusiness] = useState(false)

  const securityForm = useForm()
  const [savingPassword, setSavingPassword] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const newPassword = securityForm.watch('newPassword')

  useEffect(() => {
    Promise.all([
      adminService.getProfile(),
      adminService.getBusinessSettings(),
    ]).then(([profileRes, businessRes]) => {
      profileForm.reset(profileRes.data.data)
      businessForm.reset(businessRes.data.data)
    }).catch(() => {
      toast.error('Could not load settings.')
    }).finally(() => setLoading(false))
  }, [])

  const onSaveProfile = async (data) => {
    setSavingProfile(true)
    try {
      const res = await adminService.updateProfile({ name: data.name, email: data.email })
      updateUser({ name: res.data.data.name, email: res.data.data.email })
      toast.success('Profile updated!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  const onSaveBusiness = async (data) => {
    setSavingBusiness(true)
    try {
      const res = await adminService.updateBusinessSettings({
        companyName:    data.companyName,
        gstin:          data.gstin,
        cgstPercentage: Number(data.cgstPercentage),
        sgstPercentage: Number(data.sgstPercentage),
        supportEmail:   data.supportEmail,
        supportPhone:   data.supportPhone,
        address:        data.address,
        supportHours:   data.supportHours,
        homeBaseLocation: data.homeBaseLocation,
        cancellationFee: Number(data.cancellationFee),
        rescheduleFee: Number(data.rescheduleFee),
        freeCancellationWindowHours: Number(data.freeCancellationWindowHours),
        minDepositAmount: Number(data.minDepositAmount),
        referralBonus: Number(data.referralBonus),
        streakRewardAmount: Number(data.streakRewardAmount),
        streakMilestoneMonths: Number(data.streakMilestoneMonths),
        silverTierMinTrips: Number(data.silverTierMinTrips),
        goldTierMinTrips: Number(data.goldTierMinTrips),
        silverDiscountPct: Number(data.silverDiscountPct),
        goldDiscountPct: Number(data.goldDiscountPct),
        localFreeKmLimit: Number(data.localFreeKmLimit),
        outstationMinKmPerDay: Number(data.outstationMinKmPerDay),
        extraKmSlabSize: Number(data.extraKmSlabSize),
        extraKmSlabCharge: Number(data.extraKmSlabCharge),
        localFallbackRatePerDay: Number(data.localFallbackRatePerDay),
        damageApprovalThreshold: Number(data.damageApprovalThreshold),
        maxKmPerDaySanityLimit: Number(data.maxKmPerDaySanityLimit),
      })
      businessForm.reset(res.data.data)
      toast.success('Business settings saved! These now apply across the app (invoices, GST, support page).')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save business settings.')
    } finally {
      setSavingBusiness(false)
    }
  }

  const onChangePassword = async (data) => {
    setSavingPassword(true)
    try {
      await adminService.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      })
      toast.success('Password changed successfully!')
      securityForm.reset()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password.')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="max-w-2xl space-y-4 animate-pulse">
          <div className="h-8 bg-gray-100 rounded-xl w-1/3" />
          <div className="h-64 bg-gray-100 rounded-2xl" />
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="max-w-2xl">
        <div className="page-title mb-2">Admin Settings</div>
        <p className="text-gray-500 text-sm mb-6">Manage your profile, business details and security.</p>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit flex-wrap">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ' +
                (activeTab === key ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {activeTab === 'profile' && (
          <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="card space-y-4">
            <h3 className="section-title flex items-center gap-2">
              <FiUser className="text-orange-500" /> Admin Profile
            </h3>
            <div>
              <label className="form-label flex items-center gap-1.5">
                <FiUser size={12} /> Name *
              </label>
              <input {...profileForm.register('name', { required: 'Required' })} className="form-input" />
              {profileForm.formState.errors.name && (
                <p className="form-error">{profileForm.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="form-label flex items-center gap-1.5">
                <FiMail size={12} /> Email *
              </label>
              <input type="email" {...profileForm.register('email', {
                required: 'Required',
                pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email format' },
              })} className="form-input" />
              {profileForm.formState.errors.email && (
                <p className="form-error">{profileForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="flex justify-between items-center py-2 border-t border-gray-100 pt-4">
              <span className="text-gray-400 text-sm flex items-center gap-1.5">
                <FiShield size={12} /> Role
              </span>
              <span className="badge-info">{user?.role || 'ADMIN'}</span>
            </div>
            <button type="submit" disabled={savingProfile}
              className="btn-primary flex items-center gap-2 py-2.5 px-6 disabled:opacity-60">
              <FiSave size={15} /> {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        )}

        {activeTab === 'business' && (
          <form onSubmit={businessForm.handleSubmit(onSaveBusiness)} className="card space-y-4">
            <h3 className="section-title flex items-center gap-2">
              <FiBriefcase className="text-orange-500" /> Business Settings
            </h3>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              ℹ️ GST% here drives invoice calculations app-wide. Support email/phone/hours show on the customer Help & Support page.
            </div>

            <div>
              <label className="form-label">Company Name *</label>
              <input {...businessForm.register('companyName', { required: 'Required' })} className="form-input" />
              {businessForm.formState.errors.companyName && (
                <p className="form-error">{businessForm.formState.errors.companyName.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">GSTIN *</label>
              <input {...businessForm.register('gstin', {
                required: 'Required',
                pattern: { value: /^[0-9A-Z]{15}$/, message: 'Enter a valid 15-character GSTIN' },
              })} className="form-input font-mono" placeholder="27AABCD1234E1Z5" maxLength={15} />
              {businessForm.formState.errors.gstin && (
                <p className="form-error">{businessForm.formState.errors.gstin.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">CGST (%) *</label>
                <input type="number" step="0.1" {...businessForm.register('cgstPercentage', {
                  required: 'Required', min: { value: 0, message: 'Cannot be negative' },
                  max: { value: 50, message: 'Too high' },
                })} className="form-input" />
                {businessForm.formState.errors.cgstPercentage && (
                  <p className="form-error">{businessForm.formState.errors.cgstPercentage.message}</p>
                )}
              </div>
              <div>
                <label className="form-label">SGST (%) *</label>
                <input type="number" step="0.1" {...businessForm.register('sgstPercentage', {
                  required: 'Required', min: { value: 0, message: 'Cannot be negative' },
                  max: { value: 50, message: 'Too high' },
                })} className="form-input" />
                {businessForm.formState.errors.sgstPercentage && (
                  <p className="form-error">{businessForm.formState.errors.sgstPercentage.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Support Email *</label>
                <input type="email" {...businessForm.register('supportEmail', {
                  required: 'Required',
                  pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email format' },
                })} className="form-input" />
                {businessForm.formState.errors.supportEmail && (
                  <p className="form-error">{businessForm.formState.errors.supportEmail.message}</p>
                )}
              </div>
              <div>
                <label className="form-label">Support Phone</label>
                <input {...businessForm.register('supportPhone', {
                  pattern: { value: /^\d{10}$/, message: 'Enter valid 10-digit number' },
                })} className="form-input" placeholder="9876543210" maxLength={10} />
                {businessForm.formState.errors.supportPhone && (
                  <p className="form-error">{businessForm.formState.errors.supportPhone.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="form-label">Home Base Location *</label>
              <input {...businessForm.register('homeBaseLocation', { required: 'Required' })} className="form-input"
                placeholder="e.g. Patna" />
              <p className="text-gray-400 text-[11px] mt-1">City every car is based in — where all pickups start from.</p>
              {businessForm.formState.errors.homeBaseLocation && (
                <p className="form-error">{businessForm.formState.errors.homeBaseLocation.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Business Address</label>
              <textarea {...businessForm.register('address')} rows={2}
                className="form-input resize-none" placeholder="Registered office address" />
            </div>

            <div>
              <label className="form-label">Support Hours</label>
              <input {...businessForm.register('supportHours')} className="form-input" />
            </div>

            <button type="submit" disabled={savingBusiness}
              className="btn-primary flex items-center gap-2 py-2.5 px-6 disabled:opacity-60">
              <FiSave size={15} /> {savingBusiness ? 'Saving...' : 'Save Business Settings'}
            </button>
          </form>
        )}

        {activeTab === 'policies' && (
          <form onSubmit={businessForm.handleSubmit(onSaveBusiness)} className="card space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
              ℹ️ These numbers used to be fixed in code — now they take effect immediately app-wide the moment you save here.
            </div>

            <div>
              <h4 className="font-bold text-gray-700 text-sm mb-3">Cancellation & Booking</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Cancellation Fee (₹)</label>
                  <input type="number" step="1" {...businessForm.register('cancellationFee', { required: true, min: 0 })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Reschedule Fee (₹)</label>
                  <input type="number" step="1" {...businessForm.register('rescheduleFee', { required: true, min: 0 })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Free Cancellation Window (hours)</label>
                  <input type="number" step="1" {...businessForm.register('freeCancellationWindowHours', { required: true, min: 0 })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Minimum Deposit (₹)</label>
                  <input type="number" step="1" {...businessForm.register('minDepositAmount', { required: true, min: 0 })} className="form-input" />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <h4 className="font-bold text-gray-700 text-sm mb-3">Referral & Loyalty</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Referral Bonus (₹, each side)</label>
                  <input type="number" step="1" {...businessForm.register('referralBonus', { required: true, min: 0 })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Streak Reward (₹)</label>
                  <input type="number" step="1" {...businessForm.register('streakRewardAmount', { required: true, min: 0 })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Streak Milestone (months)</label>
                  <input type="number" step="1" {...businessForm.register('streakMilestoneMonths', { required: true, min: 1 })} className="form-input" />
                </div>
                <div></div>
                <div>
                  <label className="form-label">Silver Tier — Min Trips</label>
                  <input type="number" step="1" {...businessForm.register('silverTierMinTrips', { required: true, min: 1 })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Silver Tier — Discount (%)</label>
                  <input type="number" step="0.5" {...businessForm.register('silverDiscountPct', { required: true, min: 0, max: 100 })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Gold Tier — Min Trips</label>
                  <input type="number" step="1" {...businessForm.register('goldTierMinTrips', { required: true, min: 1 })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Gold Tier — Discount (%)</label>
                  <input type="number" step="0.5" {...businessForm.register('goldDiscountPct', { required: true, min: 0, max: 100 })} className="form-input" />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <h4 className="font-bold text-gray-700 text-sm mb-3">OUTSTATION Trip Pricing</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Minimum KM Guaranteed / Day</label>
                  <input type="number" step="1" {...businessForm.register('outstationMinKmPerDay', { required: true, min: 0 })} className="form-input" />
                  <p className="text-xs text-gray-400 mt-1">
                    A 3-day trip is billed for at least 3 × this many km, even if the actual route is shorter —
                    same as a real cab operator's outstation package.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <h4 className="font-bold text-gray-700 text-sm mb-3">LOCAL Trip Pricing</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Free KM Included</label>
                  <input type="number" step="1" {...businessForm.register('localFreeKmLimit', { required: true, min: 0 })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Extra KM Slab Size</label>
                  <input type="number" step="1" {...businessForm.register('extraKmSlabSize', { required: true, min: 1 })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Extra KM Slab Charge (₹)</label>
                  <input type="number" step="1" {...businessForm.register('extraKmSlabCharge', { required: true, min: 0 })} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Fallback Rate/Day (₹)</label>
                  <input type="number" step="1" {...businessForm.register('localFallbackRatePerDay', { required: true, min: 0 })} className="form-input" />
                  <p className="text-gray-400 text-[11px] mt-1">Used only if a car has no per-day rate set.</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <h4 className="font-bold text-gray-700 text-sm mb-3">Rental Return Sanity Checks</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Damage Approval Threshold (₹)</label>
                  <input type="number" step="1" {...businessForm.register('damageApprovalThreshold', { required: true, min: 0 })} className="form-input" />
                  <p className="text-gray-400 text-[11px] mt-1">Damage a Driver reports above this needs your approval before it's billed.</p>
                </div>
                <div>
                  <label className="form-label">Max Plausible KM/Day</label>
                  <input type="number" step="1" {...businessForm.register('maxKmPerDaySanityLimit', { required: true, min: 1 })} className="form-input" />
                  <p className="text-gray-400 text-[11px] mt-1">Odometer readings implying more than this per day are rejected as likely typos.</p>
                </div>
              </div>
            </div>

            <button type="submit" disabled={savingBusiness}
              className="btn-primary flex items-center gap-2 py-2.5 px-6 disabled:opacity-60">
              <FiSave size={15} /> {savingBusiness ? 'Saving...' : 'Save Pricing & Policies'}
            </button>
          </form>
        )}

        {activeTab === 'security' && (
          <form onSubmit={securityForm.handleSubmit(onChangePassword)} className="card space-y-4">
            <h3 className="section-title flex items-center gap-2">
              <FiLock className="text-orange-500" /> Change Password
            </h3>

            <div>
              <label className="form-label">Current Password *</label>
              <div className="relative">
                <input type={showCurrent ? 'text' : 'password'}
                  {...securityForm.register('currentPassword', { required: 'Required' })}
                  className="form-input pr-10" autoComplete="current-password" />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600">
                  {showCurrent ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              {securityForm.formState.errors.currentPassword && (
                <p className="form-error">{securityForm.formState.errors.currentPassword.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">New Password *</label>
              <div className="relative">
                <input type={showNew ? 'text' : 'password'}
                  {...securityForm.register('newPassword', {
                    required: 'Required',
                    minLength: { value: 6, message: 'Minimum 6 characters' },
                  })}
                  className="form-input pr-10" autoComplete="new-password" placeholder="Minimum 6 characters" />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600">
                  {showNew ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              {securityForm.formState.errors.newPassword && (
                <p className="form-error">{securityForm.formState.errors.newPassword.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Confirm New Password *</label>
              <input type="password"
                {...securityForm.register('confirmPassword', {
                  required: 'Please confirm your new password',
                  validate: v => v === newPassword || 'Passwords do not match',
                })}
                className="form-input" autoComplete="new-password" placeholder="Re-enter new password" />
              {securityForm.formState.errors.confirmPassword && (
                <p className="form-error">{securityForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <button type="submit" disabled={savingPassword}
              className="btn-primary flex items-center gap-2 py-2.5 px-6 disabled:opacity-60">
              <FiSave size={15} /> {savingPassword ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        )}
      </div>
    </AdminLayout>
  )
}
