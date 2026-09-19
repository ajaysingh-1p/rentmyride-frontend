import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiKey, FiTruck, FiAlertTriangle, FiCheckCircle, FiCamera, FiX } from 'react-icons/fi'
import AdminLayout from '../../components/layout/AdminLayout'
import AuthenticatedImage from '../../components/common/AuthenticatedImage'
import { selfDriveHandoverService, fileService } from '../../services/allServices'
import { formatCurrency, formatDate } from '../../utils/helpers'

// Admin/staff handover desk for self-drive bookings.
//
// Left: bookings waiting for the keys to go out today. Right: cars currently out with
// customers. Each action needs the 6-digit code the customer is holding on their own phone —
// that's what ties this desk action to a real person standing at the counter, so neither side
// can move the booking on its own.
export default function SelfDriveHandover() {
  const [pending, setPending] = useState([])
  const [active, setActive] = useState([])
  const [loading, setLoading] = useState(true)
  const [pickupTarget, setPickupTarget] = useState(null)
  const [returnTarget, setReturnTarget] = useState(null)
  const [settlement, setSettlement] = useState(null)

  const fetchAll = useCallback(() => {
    setLoading(true)
    Promise.all([
      selfDriveHandoverService.getPendingHandovers(),
      selfDriveHandoverService.getActiveHandovers(),
    ])
      .then(([p, a]) => {
        setPending(p.data.data || [])
        setActive(a.data.data || [])
      })
      .catch(() => toast.error('Could not load self-drive handovers.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Self-Drive Handover Desk</h1>
        <p className="text-gray-500 text-sm">
          Hand over and take back self-drive cars. Ask the customer for the code on their app.
        </p>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">

          {/* ── Waiting for pickup ── */}
          <section>
            <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <FiKey className="text-orange-500" /> Ready for handover ({pending.length})
            </h2>
            {pending.length === 0 && (
              <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4">
                No self-drive pickups due today.
              </p>
            )}
            <div className="space-y-3">
              {pending.map(p => (
                <div key={p.reservationId} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <div>
                      <p className="font-bold text-gray-800">{p.carBrand} {p.carModel}</p>
                      <p className="text-xs text-gray-500 uppercase">{p.carRegistrationNumber}</p>
                    </div>
                    <span className="text-xs text-gray-400">#RES-{p.reservationId}</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {p.customerName} · {p.customerMobile}
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    {formatDate(p.pickupDate)} {p.pickupTime} → {formatDate(p.returnDate)} · {p.pickupLocation}
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    Deposit held: <strong>{formatCurrency(p.depositHeld)}</strong>
                    {' · '}Paid {formatCurrency(p.amountPaid)} / {formatCurrency(p.estimatedAmount)}
                  </p>
                  {p.fullyPaid ? (
                    <button onClick={() => setPickupTarget(p)}
                      className="btn-primary w-full py-2 text-sm">Hand Over Keys</button>
                  ) : (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2
                                  flex items-start gap-1.5">
                      <FiAlertTriangle className="mt-0.5 shrink-0" />
                      Balance due — the fare and security deposit must be fully paid before handover.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── Currently out ── */}
          <section>
            <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <FiTruck className="text-blue-500" /> Currently out ({active.length})
            </h2>
            {active.length === 0 && (
              <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4">
                No self-drive cars are out right now.
              </p>
            )}
            <div className="space-y-3">
              {active.map(a => (
                <div key={a.rentalId}
                  className={'bg-white rounded-xl border p-4 ' +
                    (a.overdue ? 'border-red-300' : 'border-gray-200')}>
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <div>
                      <p className="font-bold text-gray-800">{a.carBrand} {a.carModel}</p>
                      <p className="text-xs text-gray-500 uppercase">{a.carRegistrationNumber}</p>
                    </div>
                    {a.overdue && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">
                        OVERDUE
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{a.customerName} · {a.customerMobile}</p>
                  <p className="text-xs text-gray-500 mb-2">
                    Out since {formatDate(a.actualPickupDatetime)} · due back {formatDate(a.scheduledReturnDatetime)}
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    Odo at pickup: <strong>{a.odometerAtPickup} km</strong>
                    {' · '}Included {Math.round(a.freeKmAllowance)} km
                    {' · '}Deposit {formatCurrency(a.depositHeld)}
                  </p>
                  <button onClick={() => setReturnTarget(a)}
                    className="w-full py-2 text-sm font-semibold rounded-lg border-2 border-orange-400
                               text-orange-600 hover:bg-orange-50">
                    Take Car Back
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {pickupTarget && (
        <PickupModal target={pickupTarget}
          onClose={() => setPickupTarget(null)}
          onDone={() => { setPickupTarget(null); fetchAll() }} />
      )}

      {returnTarget && (
        <ReturnModal target={returnTarget}
          onClose={() => setReturnTarget(null)}
          onDone={(result) => { setReturnTarget(null); setSettlement(result); fetchAll() }} />
      )}

      {settlement && (
        <SettlementModal settlement={settlement} onClose={() => setSettlement(null)} />
      )}
    </AdminLayout>
  )
}

// ── Photo evidence ──────────────────────────────────────────────────────────

// Shared by both the pickup and return forms. Uploads go straight to
// /api/files/upload?type=handover as soon as a file is picked — so by the time the admin hits
// Confirm, the URLs are already sitting in the parent's state ready to submit alongside the OTP.
// A max of 6 keeps a distracted staff member from turning this into an unbounded photo dump.
function PhotoUploader({ photos, setPhotos, label }) {
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList).slice(0, 6 - photos.length)
    if (files.length === 0) { toast.error('Maximum 6 photos.'); return }
    setUploading(true)
    try {
      const uploaded = await Promise.all(files.map(f => fileService.upload(f, 'handover')))
      setPhotos(prev => [...prev, ...uploaded.map(res => res.data.data.url)])
    } catch (err) {
      toast.error(err.response?.data?.message || 'One or more photos failed to upload.')
    } finally { setUploading(false) }
  }

  return (
    <div className="mb-3">
      <label className="form-label">{label} — optional, up to 6</label>
      <div className="grid grid-cols-4 gap-2 mb-2">
        {photos.map((url, i) => (
          <div key={url + i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
            <AuthenticatedImage src={url} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-5 h-5
                         flex items-center justify-center text-xs">
              <FiX />
            </button>
          </div>
        ))}
        {photos.length < 6 && (
          <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300
                             flex items-center justify-center text-gray-400 cursor-pointer
                             hover:border-orange-400 hover:text-orange-400">
            {uploading ? '⏳' : <FiCamera />}
            <input type="file" accept="image/*" multiple className="hidden" disabled={uploading}
              onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = '' }} />
          </label>
        )}
      </div>
    </div>
  )
}

// ── Pickup ────────────────────────────────────────────────────────────────────

function PickupModal({ target, onClose, onDone }) {
  const [otp, setOtp] = useState('')
  const [odometer, setOdometer] = useState('')
  const [fuel, setFuel] = useState('')
  const [remarks, setRemarks] = useState('')
  const [photos, setPhotos] = useState([])
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (otp.trim().length !== 6) { toast.error("Enter the customer's 6-digit code."); return }
    if (!odometer) { toast.error('Enter the odometer reading.'); return }
    setSaving(true)
    try {
      await selfDriveHandoverService.confirmPickup({
        reservationId: target.reservationId,
        otp: otp.trim(),
        odometerAtPickup: Number(odometer),
        fuelLevelAtPickup: fuel === '' ? null : Number(fuel),
        remarks: remarks || null,
        photoUrls: photos,
      })
      toast.success('Keys handed over — trip started.')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Handover failed.')
    } finally { setSaving(false) }
  }

  return (
    <Modal title={'Hand over — ' + target.carBrand + ' ' + target.carModel} onClose={onClose}>
      <p className="text-sm text-gray-600 mb-4">
        Verify <strong>{target.customerName}</strong>'s original driving licence, then ask for the
        6-digit code shown in their app.
      </p>
      <Field label="Customer's pickup code">
        <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="form-input tracking-[0.5em] text-center text-lg font-bold" placeholder="••••••" />
      </Field>
      <Field label="Odometer at pickup (km)">
        <input type="number" value={odometer} onChange={e => setOdometer(e.target.value)}
          className="form-input" placeholder="e.g. 24500" />
      </Field>
      <Field label="Fuel level (%) — optional">
        <input type="number" min="0" max="100" value={fuel} onChange={e => setFuel(e.target.value)}
          className="form-input" placeholder="e.g. 80" />
      </Field>
      <PhotoUploader photos={photos} setPhotos={setPhotos} label="Condition photos at handover" />
      <Field label="Remarks — optional">
        <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
          className="form-input" placeholder="Existing scratches, tyre condition, etc." />
      </Field>
      <button onClick={submit} disabled={saving} className="btn-primary w-full py-3 disabled:opacity-60">
        {saving ? '⏳ Confirming...' : 'Confirm Handover & Start Trip'}
      </button>
    </Modal>
  )
}

// ── Return ────────────────────────────────────────────────────────────────────

function ReturnModal({ target, onClose, onDone }) {
  const [otp, setOtp] = useState('')
  const [odometer, setOdometer] = useState('')
  const [fuel, setFuel] = useState('')
  const [damage, setDamage] = useState('')
  const [remarks, setRemarks] = useState('')
  const [photos, setPhotos] = useState([])
  const [saving, setSaving] = useState(false)

  const kmDriven = odometer ? Number(odometer) - Number(target.odometerAtPickup) : null
  const extraKm = kmDriven != null ? Math.max(0, kmDriven - target.freeKmAllowance) : null

  const submit = async () => {
    if (otp.trim().length !== 6) { toast.error("Enter the customer's 6-digit return code."); return }
    if (!odometer) { toast.error('Enter the closing odometer reading.'); return }
    if (kmDriven < 0) { toast.error("Closing reading can't be less than the pickup reading."); return }
    if (Number(damage) > 0 && photos.length === 0) {
      toast.error('Add at least one photo to back up the damage charge.'); return
    }
    setSaving(true)
    try {
      const res = await selfDriveHandoverService.confirmReturn({
        rentalId: target.rentalId,
        otp: otp.trim(),
        odometerAtReturn: Number(odometer),
        fuelLevelAtReturn: fuel === '' ? null : Number(fuel),
        damageCharges: damage === '' ? 0 : Number(damage),
        actualReturnDatetime: null,
        remarks: remarks || null,
        photoUrls: photos,
      })
      onDone(res.data.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not close the trip.')
    } finally { setSaving(false) }
  }

  return (
    <Modal title={'Take back — ' + target.carBrand + ' ' + target.carModel} onClose={onClose}>
      <p className="text-sm text-gray-600 mb-4">
        Inspect the car, then ask <strong>{target.customerName}</strong> for the return code in their app.
      </p>
      {target.pickupPhotoUrls?.length > 0 && (
        <div className="mb-4">
          <p className="form-label mb-1">Condition at pickup — compare before noting damage</p>
          <div className="grid grid-cols-4 gap-2">
            {target.pickupPhotoUrls.map((url, i) => (
              <div key={url + i} className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                <AuthenticatedImage src={url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
      <Field label="Customer's return code">
        <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="form-input tracking-[0.5em] text-center text-lg font-bold" placeholder="••••••" />
      </Field>
      <Field label={'Odometer at return (km) — pickup was ' + target.odometerAtPickup}>
        <input type="number" value={odometer} onChange={e => setOdometer(e.target.value)}
          className="form-input" placeholder="e.g. 24780" />
      </Field>
      {kmDriven != null && kmDriven >= 0 && (
        <p className="text-xs text-gray-600 -mt-2 mb-3">
          {Math.round(kmDriven)} km driven · {Math.round(target.freeKmAllowance)} km included
          {extraKm > 0
            ? ' · ' + Math.round(extraKm) + ' km extra @ ' + formatCurrency(target.overageRatePerKm) + '/km'
            : ' · within the free limit'}
        </p>
      )}
      <Field label="Fuel level (%) — optional">
        <input type="number" min="0" max="100" value={fuel} onChange={e => setFuel(e.target.value)}
          className="form-input" placeholder="e.g. 60" />
      </Field>
      <Field label="Damage charges (₹) — leave blank if none">
        <input type="number" value={damage} onChange={e => setDamage(e.target.value)}
          className="form-input" placeholder="0" />
      </Field>
      <PhotoUploader photos={photos} setPhotos={setPhotos}
        label={Number(damage) > 0 ? 'Condition photos at return (required — damage charged)' : 'Condition photos at return'} />
      <Field label="Remarks — optional">
        <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
          className="form-input" placeholder="New dent on rear bumper, etc." />
      </Field>
      <button onClick={submit} disabled={saving} className="btn-primary w-full py-3 disabled:opacity-60">
        {saving ? '⏳ Settling...' : 'Close Trip & Settle Deposit'}
      </button>
    </Modal>
  )
}

// ── Settlement receipt ────────────────────────────────────────────────────────

function SettlementModal({ settlement, onClose }) {
  const s = settlement
  return (
    <Modal title="Deposit Settlement" onClose={onClose}>
      <div className="flex items-center gap-2 text-green-600 mb-4">
        <FiCheckCircle /> <span className="font-semibold text-sm">Trip closed</span>
      </div>
      <div className="space-y-2 text-sm">
        <Row label="Km driven" value={Math.round(s.kmDriven) + ' km'} />
        <Row label="Included allowance" value={Math.round(s.freeKmAllowance) + ' km'} />
        <Row label="Trip fare" value={formatCurrency(s.fareAmount)} />
        {s.extraKmCharges > 0 &&
          <Row label={'Extra km (' + Math.round(s.extraKm) + ' km)'} value={formatCurrency(s.extraKmCharges)} />}
        {s.lateReturnCharges > 0 &&
          <Row label={'Late return (' + s.lateHours + ' hr)'} value={formatCurrency(s.lateReturnCharges)} />}
        {s.damageCharges > 0 &&
          <Row label="Damage" value={formatCurrency(s.damageCharges)} />}
        <div className="border-t border-gray-200 pt-2">
          <Row label="Total deductions" value={formatCurrency(s.totalDeductions)} bold />
          <Row label="Deposit held" value={formatCurrency(s.depositHeld)} />
          {s.depositRefunded > 0 &&
            <Row label={s.depositRefundMethod === 'RAZORPAY' ? 'Refunded to original payment method' : 'Refunded to wallet'}
              value={formatCurrency(s.depositRefunded)} green bold />}
          {s.extraAmountDue > 0 &&
            <Row label="Still due from customer" value={formatCurrency(s.extraAmountDue)} red bold />}
          <Row label="Final bill" value={formatCurrency(s.finalBillAmount)} bold />
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-4">{s.summary}</p>
      {(s.pickupPhotoUrls?.length > 0 || s.returnPhotoUrls?.length > 0) && (
        <div className="mt-4 space-y-3">
          {s.pickupPhotoUrls?.length > 0 && (
            <div>
              <p className="form-label mb-1">Pickup</p>
              <div className="grid grid-cols-4 gap-2">
                {s.pickupPhotoUrls.map((url, i) => (
                  <div key={'p' + i} className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                    <AuthenticatedImage src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {s.returnPhotoUrls?.length > 0 && (
            <div>
              <p className="form-label mb-1">Return</p>
              <div className="grid grid-cols-4 gap-2">
                {s.returnPhotoUrls.map((url, i) => (
                  <div key={'r' + i} className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                    <AuthenticatedImage src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <button onClick={onClose} className="btn-primary w-full py-2.5 mt-4">Done</button>
    </Modal>
  )
}

// ── Small shared bits ─────────────────────────────────────────────────────────

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-bold text-gray-800 text-lg pr-4">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}

function Row({ label, value, bold, green, red }) {
  return (
    <div className={'flex justify-between ' +
      (green ? 'text-green-600 ' : red ? 'text-red-600 ' : 'text-gray-600 ') +
      (bold ? 'font-bold' : '')}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
