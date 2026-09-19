import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { rentalService, reservationService, driverService } from '../../services/allServices'
import AdminLayout from '../../components/layout/AdminLayout'
import { formatCurrency, formatDate, formatDateTime, getBadgeClass, getStatusInfo } from '../../utils/helpers'
import { RENTAL_STATUS } from '../../utils/constants'
import { FiSearch, FiX, FiEye, FiPlus, FiSave } from 'react-icons/fi'

export default function ManageRentals() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm()
  const [rentals,   setRentals]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState('ACTIVE')
  const [selected,  setSelected]  = useState(null)
  const [showPickup, setShowPickup] = useState(false)
  const [showReturn, setShowReturn] = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [drivers,   setDrivers]   = useState([])
  const [reservations, setReservations] = useState([])
  // Issue #21 — pending damage-charge approvals queue
  const [pendingDamage, setPendingDamage] = useState([])
  const [resolvingId, setResolvingId] = useState(null)
  const [sortKey, setSortKey] = useState('rentalStatus')
  const [sortDir, setSortDir] = useState('asc')

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [rentsRes, driversRes, resRes, pendingRes] = await Promise.all([
        rentalService.getAll(),
        driverService.getByStatus('ACTIVE'),
        reservationService.getAll(),
        rentalService.getPendingDamageApprovals(),
      ])
      setRentals(rentsRes.data.data || [])
      setDrivers(driversRes.data.data || [])
      setReservations((resRes.data.data || []).filter(r => r.reservationStatus === 'CONFIRMED'))
      setPendingDamage(pendingRes.data.data || [])
    } catch { toast.error('Failed to load rentals.') }
    finally { setLoading(false) }
  }

  const handleDamageDecision = async (rentalId, approve) => {
    setResolvingId(rentalId)
    try {
      const res = approve ? await rentalService.approveDamageCharge(rentalId) : await rentalService.rejectDamageCharge(rentalId)
      toast.success(approve ? 'Damage charge approved and added to the bill.' : 'Damage charge rejected.')
      setPendingDamage(prev => prev.filter(r => r.rentalId !== rentalId))
      setRentals(prev => prev.map(r => r.rentalId === rentalId ? res.data.data : r))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resolve damage charge.')
    } finally {
      setResolvingId(null)
    }
  }

  // Initiate Rental (Pickup)
  const onPickup = async (data) => {
    setSaving(true)
    try {
      const res = await rentalService.pickup({
        reservationId:       Number(data.reservationId),
        driverId:            data.driverId ? Number(data.driverId) : null,
        odometerAtPickup:    Number(data.odometerAtPickup),
        actualPickupDatetime: new Date().toISOString(),
        remarks:             data.remarks || null,
      })
      if (res.data.success) {
        toast.success('Rental started! 🚗')
        setShowPickup(false); reset(); fetchAll()
      } else { toast.error(res.data.message || 'Failed.') }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Pickup failed.')
    } finally { setSaving(false) }
  }

  // Complete Rental (Return)
  const onReturn = async (data) => {
    setSaving(true)
    try {
      const res = await rentalService.returnCar(showReturn.rentalId, {
        odometerAtReturn:     Number(data.odometerAtReturn),
        actualReturnDatetime: new Date().toISOString(),
        damageCharges:        data.damageCharges ? Number(data.damageCharges) : 0,
        discountAmount:       data.discountAmount ? Number(data.discountAmount) : 0,
        remarks:              data.remarks || null,
      })
      if (res.data.success) {
        toast.success('Rental completed! ✅')
        setShowReturn(null); reset(); fetchAll()
      } else { toast.error(res.data.message || 'Failed.') }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Return failed.')
    } finally { setSaving(false) }
  }

  const filtered = rentals.filter(r => {
    const matchFilter = !filter || r.rentalStatus === filter
    const matchSearch = !search ||
      (r.carBrand + ' ' + r.carModel).toLowerCase().includes(search.toLowerCase()) ||
      r.customerName?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  // Sorting — click a column header to sort by it, click again to flip direction. Defaults to
  // ACTIVE trips first (they're the ones needing attention right now), then most recently
  // started, so switching to the "All" filter still surfaces what's currently on the road
  // before anything already completed or cancelled.
  const RENTAL_STATUS_PRIORITY = { ACTIVE: 0, COMPLETED: 1, CANCELLED: 2 }
  const RENTAL_SORTERS = {
    rentalId:       r => r.rentalId,
    customerName:   r => (r.customerName || '').toLowerCase(),
    pickup:         r => r.actualPickupDatetime || '',
    totalAmount:    r => r.totalAmount || 0,
    rentalStatus:   r => RENTAL_STATUS_PRIORITY[r.rentalStatus] ?? 9,
  }
  const sorted = [...filtered].sort((a, b) => {
    const getter = RENTAL_SORTERS[sortKey] || RENTAL_SORTERS.rentalStatus
    const av = getter(a), bv = getter(b)
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    if (cmp !== 0) return sortDir === 'asc' ? cmp : -cmp
    // Tie-break by most recent pickup so same-status rows stay in a sensible order.
    return (b.actualPickupDatetime || '').localeCompare(a.actualPickupDatetime || '')
  })
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }
  const SortHeader = ({ sortKeyName, children }) => (
    <th onClick={() => toggleSort(sortKeyName)} className="cursor-pointer select-none hover:text-gray-700">
      {children} {sortKey === sortKeyName && (sortDir === 'asc' ? '▲' : '▼')}
    </th>
  )

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="page-title">Manage Rentals</h2>
          <p className="text-gray-500 text-sm">{rentals.length} total rentals</p>
        </div>
        <button onClick={() => { reset(); setShowPickup(true) }}
          className="btn-primary flex items-center gap-2 py-2.5">
          <FiPlus size={16} /> Start Rental
        </button>
      </div>

      {/* Issue #21 — Pending damage-charge approvals */}
      {pendingDamage.length > 0 && (
        <div className="card mb-5 border-2 border-amber-200 bg-amber-50">
          <h3 className="font-bold text-amber-800 text-sm mb-3 flex items-center gap-2">
            ⚠️ Damage Charges Awaiting Your Approval ({pendingDamage.length})
          </h3>
          <div className="space-y-2">
            {pendingDamage.map(r => (
              <div key={r.rentalId} className="bg-white rounded-xl p-3 flex items-center justify-between gap-3 border border-amber-100">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Rental #{r.rentalId} — {r.customerName || 'Customer'}</p>
                  <p className="text-xs text-gray-500">{r.carBrand} {r.carModel} · Reported damage: {formatCurrency(r.pendingDamageCharges)}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button disabled={resolvingId === r.rentalId} onClick={() => handleDamageDecision(r.rentalId, true)}
                    className="text-xs font-semibold bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">
                    Approve
                  </button>
                  <button disabled={resolvingId === r.rentalId} onClick={() => handleDamageDecision(r.rentalId, false)}
                    className="text-xs font-semibold bg-red-100 hover:bg-red-200 text-red-600 px-3 py-1.5 rounded-lg disabled:opacity-50">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {RENTAL_STATUS.map(s => (
          <div key={s.value}
            onClick={() => setFilter(filter === s.value ? '' : s.value)}
            className={'bg-white rounded-xl p-3 border-2 text-center cursor-pointer transition-all ' +
              (filter === s.value ? 'border-orange-400' : 'border-gray-100 hover:border-gray-200')}>
            <p className="text-2xl font-bold text-gray-800">
              {rentals.filter(r => r.rentalStatus === s.value).length}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card mb-5 flex gap-3 items-center">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-3.5 text-gray-400 text-sm" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="form-input pl-9" placeholder="Search customer or car..." />
        </div>
        {search && (
          <button onClick={() => setSearch('')}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-red-500">
            <FiX size={14} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={'skeleton-' + i} className="h-16 bg-white rounded-xl animate-pulse border border-gray-100" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 card">
          <p className="text-4xl mb-3">🔑</p>
          <p className="font-bold text-gray-700">No rentals found</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <SortHeader sortKeyName="rentalId">#ID</SortHeader>
                <SortHeader sortKeyName="customerName">Customer</SortHeader>
                <th>Car</th>
                <SortHeader sortKeyName="pickup">Pickup</SortHeader>
                <th>Return</th><th>KM</th>
                <SortHeader sortKeyName="totalAmount">Amount</SortHeader>
                <th>Driver</th>
                <SortHeader sortKeyName="rentalStatus">Status</SortHeader>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => {
                const s = getStatusInfo(RENTAL_STATUS, r.rentalStatus)
                return (
                  <tr key={r.rentalId}>
                    <td className="font-mono text-xs text-gray-400">#{r.rentalId}</td>
                    <td className="text-sm font-semibold text-gray-800">{r.customerName}</td>
                    <td>
                      <p className="text-sm font-semibold text-gray-800">{r.carBrand} {r.carModel}</p>
                      <p className="text-xs text-gray-400">{r.carRegistrationNumber}</p>
                    </td>
                    <td className="text-xs text-gray-500">{formatDate(r.actualPickupDatetime)}</td>
                    <td className="text-xs text-gray-500">{r.actualReturnDatetime ? formatDate(r.actualReturnDatetime) : '—'}</td>
                    <td className="text-sm text-gray-500">{r.totalKmDriven ? r.totalKmDriven + ' km' : '—'}</td>
                    <td className="font-semibold text-orange-500 text-sm">{formatCurrency(r.totalAmount)}</td>
                    <td className="text-xs text-gray-500">{r.driverName || '—'}</td>
                    <td><span className={getBadgeClass(s.color)}>{s.label}</span></td>
                    <td>
                      <div className="flex gap-1.5">
                        <button onClick={() => setSelected(r)}
                          className="w-7 h-7 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-center text-blue-500">
                          <FiEye size={12} />
                        </button>
                        {r.rentalStatus === 'ACTIVE' && (
                          <button onClick={() => { setShowReturn(r); reset() }}
                            className="text-xs bg-green-50 hover:bg-green-100 text-green-600 px-2 py-1 rounded-lg font-semibold">
                            Return
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pickup Modal */}
      {showPickup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="font-bold text-gray-800 text-lg">🚗 Start Rental (Pickup)</h3>
              <button onClick={() => setShowPickup(false)} className="text-gray-400 hover:text-gray-600"><FiX size={22} /></button>
            </div>
            <form onSubmit={handleSubmit(onPickup)} className="p-6 space-y-4">
              <div>
                <label className="form-label">Select Confirmed Reservation *</label>
                <select {...register('reservationId', { required: 'Required' })} className="form-select">
                  <option value="">Choose reservation...</option>
                  {reservations.map(r => (
                    <option key={r.reservationId} value={r.reservationId}>
                      #{r.reservationId} — {r.customerName} | {r.carBrand} {r.carModel}
                    </option>
                  ))}
                </select>
                {errors.reservationId && <p className="form-error">{errors.reservationId.message}</p>}
              </div>
              <div>
                <label className="form-label">Assign Driver (Optional)</label>
                <select {...register('driverId')} className="form-select">
                  <option value="">No driver assigned</option>
                  {drivers.map(a => (
                    <option key={a.driverId} value={a.driverId}>
                      {a.firstName} {a.lastName} — {a.mobileNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Odometer Reading at Pickup (km) *</label>
                <input type="number" {...register('odometerAtPickup', { required: 'Required', min: 0 })}
                  className="form-input" placeholder="e.g. 15000" />
                {errors.odometerAtPickup && <p className="form-error">{errors.odometerAtPickup.message}</p>}
              </div>
              <div>
                <label className="form-label">Remarks (Optional)</label>
                <textarea {...register('remarks')} rows={2} className="form-input resize-none"
                  placeholder="Any notes about car condition at pickup..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPickup(false)} className="btn-gray flex-1 py-2.5">Cancel</button>
                <button type="submit" disabled={saving}
                  className="btn-primary flex items-center justify-center gap-2 flex-1 py-2.5 disabled:opacity-60">
                  <FiSave size={15} /> {saving ? 'Starting...' : 'Start Rental'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="font-bold text-gray-800 text-lg">🏁 Complete Rental (Return)</h3>
              <button onClick={() => setShowReturn(null)} className="text-gray-400 hover:text-gray-600"><FiX size={22} /></button>
            </div>
            <div className="p-4 bg-orange-50 mx-6 mt-4 rounded-xl">
              <p className="text-sm font-semibold text-gray-800">{showReturn.carBrand} {showReturn.carModel}</p>
              <p className="text-xs text-gray-500">{showReturn.customerName} • Pickup odometer: {showReturn.odometerAtPickup} km</p>
            </div>
            <form onSubmit={handleSubmit(onReturn)} className="p-6 space-y-4">
              <div>
                <label className="form-label">Odometer Reading at Return (km) *</label>
                <input type="number" {...register('odometerAtReturn', { required: 'Required', min: showReturn.odometerAtPickup || 0 })}
                  className="form-input" placeholder={'Min: ' + showReturn.odometerAtPickup} />
                {errors.odometerAtReturn && <p className="form-error">{errors.odometerAtReturn.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Damage Charges (₹)</label>
                  <input type="number" {...register('damageCharges')} className="form-input" placeholder="0" min={0} />
                </div>
                <div>
                  <label className="form-label">Discount (₹)</label>
                  <input type="number" {...register('discountAmount')} className="form-input" placeholder="0" min={0} />
                </div>
              </div>
              <div>
                <label className="form-label">Remarks</label>
                <textarea {...register('remarks')} rows={2} className="form-input resize-none"
                  placeholder="Car condition at return, any damage notes..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowReturn(null)} className="btn-gray flex-1 py-2.5">Cancel</button>
                <button type="submit" disabled={saving}
                  className="btn-primary flex items-center justify-center gap-2 flex-1 py-2.5 disabled:opacity-60">
                  <FiSave size={15} /> {saving ? 'Completing...' : 'Complete Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="font-bold text-gray-800">Rental #{selected.rentalId}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><FiX size={22} /></button>
            </div>
            <div className="p-6 space-y-2">
              {[
                ['Customer',         selected.customerName],
                ['Car',              selected.carBrand + ' ' + selected.carModel],
                ['Reg No',           selected.carRegistrationNumber],
                ['Driver',           selected.driverName || '—'],
                ['Pickup Time',      formatDateTime(selected.actualPickupDatetime)],
                ['Return Time',      selected.actualReturnDatetime ? formatDateTime(selected.actualReturnDatetime) : '—'],
                ['Odometer Pickup',  selected.odometerAtPickup + ' km'],
                ['Odometer Return',  selected.odometerAtReturn ? selected.odometerAtReturn + ' km' : '—'],
                ['KM Driven',        selected.totalKmDriven ? selected.totalKmDriven + ' km' : '—'],
                ['Base Amount',      formatCurrency(selected.baseAmount)],
                ['Extra KM',         formatCurrency(selected.extraKmCharges || 0)],
                ['Damage',           formatCurrency(selected.damageCharges || 0)],
                ['Late Charges',     formatCurrency(selected.lateReturnCharges || 0)],
                ['Discount',         formatCurrency(selected.discountAmount || 0)],
                ['Total Amount',     formatCurrency(selected.totalAmount)],
                ['Remarks',          selected.remarks || '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-400 text-sm">{label}</span>
                  <span className="text-gray-800 text-sm font-medium text-right">{value}</span>
                </div>
              ))}
              <button onClick={() => setSelected(null)} className="btn-gray w-full py-2.5 mt-3">Close</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
