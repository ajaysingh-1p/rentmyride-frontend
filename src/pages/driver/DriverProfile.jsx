import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { driverService, fileService } from '../../services/allServices'
import api, { resolveFileUrl } from '../../services/api'
import AuthenticatedImage from '../../components/common/AuthenticatedImage'
import DriverLayout from '../../components/layout/DriverLayout'
import { FiUser, FiPhone, FiCreditCard, FiShield, FiEye, FiStar, FiTrendingUp } from 'react-icons/fi'

export default function DriverProfile() {
  const viewDocument = async (url) => {
    try {
      const res = await api.get(resolveFileUrl(url), { responseType: 'blob', baseURL: '' })
      window.open(URL.createObjectURL(res.data), '_blank')
    } catch {
      toast.error('Could not open document.')
    }
  }

  const { user, updateUser } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [driver, setDriver] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm()
  const pwForm = useForm()

  useEffect(() => { fetchAll() }, [user.userId])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const driverRes = await driverService.getById(user.userId)
      setDriver(driverRes.data.data)
      reset(driverRes.data.data)
    } catch {
      toast.error('Could not load your profile.')
    } finally {
      setLoading(false)
    }
    // Stats are a nice-to-have — don't let a failure here break the whole page
    driverService.getStats(user.userId)
      .then(res => setStats(res.data.data))
      .catch(() => setStats(null))
  }

  const onSaveProfile = async (data) => {
    setSaving(true)
    try {
      const res = await driverService.update(user.userId, {
        firstName: data.firstName,
        lastName: data.lastName,
        mobileNumber: data.mobileNumber,
        licenseNumber: data.licenseNumber,
      })
      setDriver(res.data.data)
      updateUser({ name: data.firstName + ' ' + data.lastName })
      toast.success('Profile updated!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleLicenseUpload = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const uploadRes = await fileService.upload(file)
      const url = uploadRes.data.data.url
      const res = await driverService.update(user.userId, {
        firstName: driver.firstName,
        lastName: driver.lastName,
        mobileNumber: driver.mobileNumber,
        licenseNumber: driver.licenseNumber,
        licenseImageUrl: url,
      })
      setDriver(res.data.data)
      toast.success('License photo uploaded!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed. Try again.')
    } finally {
      setUploading(false)
    }
  }

  const onChangePassword = async (data) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error("New passwords don't match.")
      return
    }
    setChangingPassword(true)
    try {
      await driverService.changePassword(user.userId, {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      })
      toast.success('Password changed successfully!')
      pwForm.reset()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password.')
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <DriverLayout>
        <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
          <div className="h-24 bg-gray-100 rounded-2xl" />
          <div className="h-64 bg-gray-100 rounded-2xl" />
        </div>
      </DriverLayout>
    )
  }

  const isPdf = driver?.licenseImageUrl?.toLowerCase().endsWith('.pdf')

  return (
    <DriverLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="page-title">My Profile</h2>
          <p className="text-gray-500 text-sm">Manage your details, documents & password.</p>
        </div>

        {/* Stats Banner */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Completed Trips', value: stats.completedTrips, icon: '🚕' },
              { label: 'This Month', value: stats.tripsThisMonth, icon: '📅' },
              { label: 'Total KM Driven', value: Math.round(stats.totalKmDriven) + ' km', icon: FiTrendingUp },
              { label: 'Avg Rating', value: stats.averageRating ? stats.averageRating + ' ⭐' : 'No ratings yet', icon: FiStar },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="card py-3 text-center">
                <div className="text-xl mb-1">
                  {typeof Icon === 'string' ? Icon : <Icon className="mx-auto text-sky-500" size={18} />}
                </div>
                <p className="font-bold text-gray-800 text-sm">{value}</p>
                <p className="text-gray-400 text-[11px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          {[
            { key: 'profile', label: 'Profile', icon: FiUser },
            { key: 'security', label: 'Security', icon: FiShield },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ' +
                (activeTab === key ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-5">
            <form onSubmit={handleSubmit(onSaveProfile)} className="card space-y-4">
              <h3 className="section-title flex items-center gap-2"><FiUser className="text-sky-500" /> Basic Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">First Name *</label>
                  <input {...register('firstName', { required: 'Required' })} className="form-input" />
                  {errors.firstName && <p className="form-error">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="form-label">Last Name *</label>
                  <input {...register('lastName', { required: 'Required' })} className="form-input" />
                  {errors.lastName && <p className="form-error">{errors.lastName.message}</p>}
                </div>
              </div>
              <div>
                <label className="form-label">Email</label>
                <input value={driver?.email || ''} disabled className="form-input bg-gray-50 text-gray-400" />
                <p className="text-gray-400 text-[11px] mt-1">Email can't be changed. Contact admin if needed.</p>
              </div>
              <div>
                <label className="form-label flex items-center gap-1.5"><FiPhone size={12} /> Mobile Number *</label>
                <input {...register('mobileNumber', { required: 'Required' })} className="form-input" />
                {errors.mobileNumber && <p className="form-error">{errors.mobileNumber.message}</p>}
              </div>
              <div>
                <label className="form-label flex items-center gap-1.5"><FiCreditCard size={12} /> License Number</label>
                <input {...register('licenseNumber')} className="form-input" />
              </div>
              <button type="submit" disabled={saving} className="btn-primary py-2.5 px-6 disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>

            {/* License Photo (KYC) */}
            <div className="card">
              <h3 className="section-title flex items-center gap-2"><FiCreditCard className="text-sky-500" /> License Photo</h3>
              <p className="text-gray-400 text-xs mb-4 -mt-3">Upload a clear photo of your driving license for verification.</p>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center max-w-xs">
                {driver?.licenseImageUrl ? (
                  isPdf ? (
                    <div className="w-full h-32 bg-gray-50 rounded-lg mb-3 flex items-center justify-center text-3xl text-gray-400">📄</div>
                  ) : (
                    // Bug fix: protected document — a plain <img> can't attach the auth token the
                    // backend now requires, so it always failed to load.
                    <AuthenticatedImage src={driver.licenseImageUrl} alt="License" className="w-full h-32 object-cover rounded-lg mb-3" />
                  )
                ) : (
                  <div className="w-full h-32 bg-gray-50 rounded-lg mb-3 flex items-center justify-center text-3xl text-gray-300">🪪</div>
                )}
                <div className="flex gap-2">
                  {driver?.licenseImageUrl && (
                    <button type="button" onClick={() => viewDocument(driver.licenseImageUrl)}
                      className="btn-gray text-xs py-2 flex-1 inline-flex items-center justify-center gap-1">
                      <FiEye size={12} /> View
                    </button>
                  )}
                  <label className={'btn-secondary text-xs py-2 cursor-pointer inline-flex items-center justify-center ' + (driver?.licenseImageUrl ? 'flex-1' : 'w-full')}>
                    {uploading ? 'Uploading...' : driver?.licenseImageUrl ? 'Replace' : 'Upload Photo'}
                    <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                      disabled={uploading} onChange={e => handleLicenseUpload(e.target.files[0])} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <form onSubmit={pwForm.handleSubmit(onChangePassword)} className="card space-y-4">
            <h3 className="section-title flex items-center gap-2"><FiShield className="text-sky-500" /> Change Password</h3>
            <div>
              <label className="form-label">Current Password *</label>
              <input type="password" {...pwForm.register('currentPassword', { required: 'Required' })} className="form-input" />
              {pwForm.formState.errors.currentPassword && <p className="form-error">{pwForm.formState.errors.currentPassword.message}</p>}
            </div>
            <div>
              <label className="form-label">New Password *</label>
              <input type="password" {...pwForm.register('newPassword', { required: 'Required', minLength: { value: 6, message: 'At least 6 characters' } })} className="form-input" />
              {pwForm.formState.errors.newPassword && <p className="form-error">{pwForm.formState.errors.newPassword.message}</p>}
            </div>
            <div>
              <label className="form-label">Confirm New Password *</label>
              <input type="password" {...pwForm.register('confirmPassword', { required: 'Required' })} className="form-input" />
              {pwForm.formState.errors.confirmPassword && <p className="form-error">{pwForm.formState.errors.confirmPassword.message}</p>}
            </div>
            <button type="submit" disabled={changingPassword} className="btn-primary py-2.5 px-6 disabled:opacity-60">
              {changingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </DriverLayout>
  )
}
