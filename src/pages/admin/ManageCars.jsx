import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { carService, fileService } from '../../services/allServices'
import { resolveFileUrl } from '../../services/api'
import AdminLayout from '../../components/layout/AdminLayout'
import { formatCurrency, getBadgeClass, getStatusInfo } from '../../utils/helpers'
import { CAR_CATEGORIES, FUEL_TYPES, TRANSMISSION_TYPES, AVAILABILITY_STATUS } from '../../utils/constants'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiSave } from 'react-icons/fi'

const EMPTY = {
  brand: '', model: '', year: '', registrationNumber: '', color: '',
  fuelType: '', transmissionType: '', carCategory: '', seatingCapacity: '',
  rentPerDay: '', ratePerKm: '', nightChargePerNight: '', mileageKmpl: '', imageUrl: '', description: '',
}

export default function ManageCars() {
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm()
  const [cars,     setCars]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState(null)  // car object being edited
  const [saving,   setSaving]   = useState(false)
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('')
  const [sortKey,  setSortKey]  = useState('availabilityStatus')
  const [sortDir,  setSortDir]  = useState('asc')
  const [deleting, setDeleting] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [imagePreview, setImagePreview] = useState('')

  useEffect(() => { fetchCars() }, [])

  const fetchCars = async () => {
    setLoading(true)
    try {
      const res = await carService.getAll()
      setCars(res.data.data || [])
    } catch { toast.error('Failed to load cars.') }
    finally { setLoading(false) }
  }

  const openAdd = () => {
    setEditing(null)
    reset(EMPTY)
    setImagePreview('')
    setShowForm(true)
  }

  const openEdit = (car) => {
    setEditing(car)
    reset({
      brand: car.brand, model: car.model, year: car.year,
      registrationNumber: car.registrationNumber, color: car.color,
      fuelType: car.fuelType, transmissionType: car.transmissionType,
      carCategory: car.carCategory, seatingCapacity: car.seatingCapacity,
      rentPerDay: car.rentPerDay, ratePerKm: car.ratePerKm || '', nightChargePerNight: car.nightChargePerNight || '', mileageKmpl: car.mileageKmpl || '',
      imageUrl: car.imageUrl || '', description: car.description || '',
    })
    setImagePreview(car.imageUrl || '')
    setShowForm(true)
  }

  const handlePhotoUpload = async (file) => {
    if (!file) return
    setUploadingPhoto(true)
    try {
      const res = await fileService.upload(file, 'car')
      const url = res.data.data.url
      setValue('imageUrl', url)
      setImagePreview(url)
      toast.success('Photo uploaded!')
    } catch {
      toast.error('Upload failed. Try again.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const closeForm = () => { setShowForm(false); setEditing(null); reset(EMPTY) }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      const payload = {
        ...data,
        year: Number(data.year),
        seatingCapacity: Number(data.seatingCapacity),
        rentPerDay: Number(data.rentPerDay),
        ratePerKm: data.ratePerKm ? Number(data.ratePerKm) : null,
        nightChargePerNight: data.nightChargePerNight ? Number(data.nightChargePerNight) : null,
        mileageKmpl: data.mileageKmpl ? Number(data.mileageKmpl) : null,
      }
      let res
      if (editing) {
        res = await carService.update(editing.carId, payload)
        toast.success('Car updated successfully!')
      } else {
        res = await carService.add(payload)
        toast.success('Car added successfully! 🚗')
      }
      if (res.data.success) { closeForm(); fetchCars() }
      else toast.error(res.data.message || 'Operation failed.')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed.')
    } finally { setSaving(false) }
  }

  const handleDelete = async (car) => {
    if (!window.confirm('Retire car ' + car.brand + ' ' + car.model + '? It will be marked as RETIRED.')) return
    setDeleting(car.carId)
    try {
      await carService.delete(car.carId)
      toast.success('Car retired.')
      fetchCars()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.')
    } finally { setDeleting(null) }
  }

  const handleStatusChange = async (carId, status) => {
    try {
      await carService.updateStatus(carId, status)
      toast.success('Status updated!')
      fetchCars()
    } catch { toast.error('Status update failed.') }
  }

  const filtered = cars.filter(c => {
    const matchSearch = !search ||
      (c.brand + ' ' + c.model).toLowerCase().includes(search.toLowerCase()) ||
      c.registrationNumber.toLowerCase().includes(search.toLowerCase())
    const matchFilter = !filter || c.availabilityStatus === filter
    return matchSearch && matchFilter
  })

  // Sorting — click a column header to sort by it, click again to flip direction. Defaults to
  // BOOKED (currently out on a trip) first — that's the status an admin most often needs to act
  // on or check up on — then AVAILABLE, then MAINTENANCE.
  const CAR_STATUS_PRIORITY = { BOOKED: 0, AVAILABLE: 1, MAINTENANCE: 2 }
  const CAR_SORTERS = {
    car:      c => (c.brand + ' ' + c.model).toLowerCase(),
    rentPerDay: c => c.rentPerDay || 0,
    availabilityStatus: c => CAR_STATUS_PRIORITY[c.availabilityStatus] ?? 9,
  }
  const sorted = [...filtered].sort((a, b) => {
    const getter = CAR_SORTERS[sortKey] || CAR_SORTERS.availabilityStatus
    const av = getter(a), bv = getter(b)
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
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

  const currentYear = new Date().getFullYear()

  return (
    <AdminLayout>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="page-title">Manage Cars</h2>
          <p className="text-gray-500 text-sm">{cars.length} total vehicles</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 py-2.5">
          <FiPlus size={16} /> Add Car
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-5 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <FiSearch className="absolute left-3 top-3.5 text-gray-400 text-sm" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="form-input pl-9" placeholder="Search brand, model or reg number..." />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="form-select w-48">
          <option value="">All Status</option>
          {AVAILABILITY_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {(search || filter) && (
          <button onClick={() => { setSearch(''); setFilter('') }}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-red-500">
            <FiX size={14} /> Clear
          </button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {AVAILABILITY_STATUS.map(s => (
          <div key={s.value} className="bg-white rounded-xl p-3 border border-gray-100 text-center">
            <p className="text-2xl font-bold text-gray-800">
              {cars.filter(c => c.availabilityStatus === s.value).length}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={'skeleton-' + i} className="h-16 bg-white rounded-xl animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 card">
          <p className="text-4xl mb-3">🚗</p>
          <p className="font-bold text-gray-700 text-lg">No cars found</p>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your search filters</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <SortHeader sortKeyName="car">Car</SortHeader>
                <th>Reg. Number</th>
                <th>Category</th>
                <th>Fuel / Trans</th>
                <th>Seats</th>
                <SortHeader sortKeyName="rentPerDay">Rent/Day</SortHeader>
                <SortHeader sortKeyName="availabilityStatus">Status</SortHeader>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(car => {
                const status = getStatusInfo(AVAILABILITY_STATUS, car.availabilityStatus)
                return (
                  <tr key={car.carId}>
                    <td>
                      <div className="flex items-center gap-3">
                        {car.imageUrl ? (
                          <img src={resolveFileUrl(car.imageUrl)} alt={car.brand}
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                        ) : null}
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center
                                        justify-center text-lg flex-shrink-0"
                          style={car.imageUrl ? { display: 'none' } : {}}>🚗</div>
                        <div>
                          <p className="font-semibold text-gray-800">
                            {car.brand} {car.model}
                          </p>
                          <p className="text-gray-400 text-xs">{car.year} • {car.color}</p>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-sm text-gray-600">{car.registrationNumber}</td>
                    <td className="text-sm">{car.carCategory?.replace('_', ' ')}</td>
                    <td className="text-sm text-gray-500">
                      {car.fuelType}<br />
                      <span className="text-xs">{car.transmissionType}</span>
                    </td>
                    <td className="text-center text-sm">{car.seatingCapacity}</td>
                    <td className="font-semibold text-orange-500">
                      {formatCurrency(car.rentPerDay)}
                      {car.ratePerKm ? (
                        <><br /><span className="text-xs text-gray-400 font-normal">₹{car.ratePerKm}/km</span></>
                      ) : null}
                    </td>
                    <td>
                      <select
                        value={car.availabilityStatus}
                        onChange={e => handleStatusChange(car.carId, e.target.value)}
                        className={'text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer ' +
                          (car.availabilityStatus === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
                           car.availabilityStatus === 'BOOKED'    ? 'bg-yellow-100 text-yellow-700' :
                           car.availabilityStatus === 'UNDER_MAINTENANCE' ? 'bg-red-100 text-red-700' :
                           'bg-gray-100 text-gray-500')}>
                        {AVAILABILITY_STATUS.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(car)}
                          className="w-8 h-8 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center
                                     justify-center text-blue-500 transition-colors">
                          <FiEdit2 size={13} />
                        </button>
                        <button onClick={() => handleDelete(car)}
                          disabled={deleting === car.carId}
                          className="w-8 h-8 bg-red-50 hover:bg-red-100 rounded-lg flex items-center
                                     justify-center text-red-500 transition-colors disabled:opacity-50">
                          <FiTrash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
              <h3 className="font-bold text-gray-800 text-lg">
                {editing ? '✏️ Edit Car' : '🚗 Add New Car'}
              </h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <FiX size={22} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Brand *</label>
                  <input {...register('brand', { required: 'Required' })}
                    className="form-input" placeholder="e.g. Maruti Suzuki" />
                  {errors.brand && <p className="form-error">{errors.brand.message}</p>}
                </div>
                <div>
                  <label className="form-label">Model *</label>
                  <input {...register('model', { required: 'Required' })}
                    className="form-input" placeholder="e.g. Swift" />
                  {errors.model && <p className="form-error">{errors.model.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Year *</label>
                  <input type="number" {...register('year', { required: 'Required', min: 2000, max: currentYear + 1 })}
                    className="form-input" placeholder={currentYear} />
                  {errors.year && <p className="form-error">{errors.year.message}</p>}
                </div>
                <div>
                  <label className="form-label">Registration No *</label>
                  <input {...register('registrationNumber', { required: 'Required' })}
                    className="form-input" placeholder="MH12AB1234" />
                  {errors.registrationNumber && <p className="form-error">{errors.registrationNumber.message}</p>}
                </div>
                <div>
                  <label className="form-label">Color</label>
                  <input {...register('color')} className="form-input" placeholder="White" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Category *</label>
                  <select {...register('carCategory', { required: 'Required' })} className="form-select">
                    <option value="">Select</option>
                    {CAR_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  {errors.carCategory && <p className="form-error">{errors.carCategory.message}</p>}
                </div>
                <div>
                  <label className="form-label">Fuel Type *</label>
                  <select {...register('fuelType', { required: 'Required' })} className="form-select">
                    <option value="">Select</option>
                    {FUEL_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  {errors.fuelType && <p className="form-error">{errors.fuelType.message}</p>}
                </div>
                <div>
                  <label className="form-label">Transmission *</label>
                  <select {...register('transmissionType', { required: 'Required' })} className="form-select">
                    <option value="">Select</option>
                    {TRANSMISSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  {errors.transmissionType && <p className="form-error">{errors.transmissionType.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-5 gap-4">
                <div>
                  <label className="form-label">Seating Capacity *</label>
                  <input type="number" {...register('seatingCapacity', { required: 'Required', min: 1 })}
                    className="form-input" placeholder="5" />
                  {errors.seatingCapacity && <p className="form-error">{errors.seatingCapacity.message}</p>}
                </div>
                <div>
                  <label className="form-label">Rent Per Day (₹) *</label>
                  <input type="number" {...register('rentPerDay', { required: 'Required', min: 1 })}
                    className="form-input" placeholder="1500" />
                  {errors.rentPerDay && <p className="form-error">{errors.rentPerDay.message}</p>}
                </div>
                <div>
                  <label className="form-label">Rate Per KM (₹)</label>
                  <input type="number" step="0.1" {...register('ratePerKm', { min: 0 })}
                    className="form-input" placeholder="12" />
                  {errors.ratePerKm && <p className="form-error">{errors.ratePerKm.message}</p>}
                  <p className="text-gray-400 text-xs mt-1">Outstation round-trip pricing.</p>
                </div>
                <div>
                  <label className="form-label">Night Charge (₹)</label>
                  <input type="number" step="10" {...register('nightChargePerNight', { min: 0 })}
                    className="form-input" placeholder="300" />
                  {errors.nightChargePerNight && <p className="form-error">{errors.nightChargePerNight.message}</p>}
                  <p className="text-gray-400 text-xs mt-1">Per night, min ₹300.</p>
                </div>
                <div>
                  <label className="form-label">Mileage (km/l)</label>
                  <input type="number" step="0.1" {...register('mileageKmpl')}
                    className="form-input" placeholder="18.5" />
                </div>
              </div>

              <div>
                <label className="form-label">Car Photo</label>
                <input type="hidden" {...register('imageUrl')} />
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-3 flex items-center gap-3">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Car" className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                      onError={() => setImagePreview('')} />
                  ) : (
                    <div className="w-20 h-20 bg-gray-50 rounded-lg flex items-center justify-center text-3xl text-gray-300 flex-shrink-0">
                      🚗
                    </div>
                  )}
                  <label className="btn-secondary text-sm py-2 px-4 cursor-pointer inline-flex items-center gap-2">
                    {uploadingPhoto ? 'Uploading...' : imagePreview ? 'Replace Photo' : 'Upload Photo'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                      disabled={uploadingPhoto}
                      onChange={e => handlePhotoUpload(e.target.files[0])} />
                  </label>
                </div>
              </div>

              <div>
                <label className="form-label">Description</label>
                <textarea {...register('description')} rows={3}
                  className="form-input resize-none"
                  placeholder="Brief description of the car..." />
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={closeForm} className="btn-gray py-2.5 px-6">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="btn-primary flex items-center gap-2 py-2.5 px-6 disabled:opacity-60">
                  <FiSave size={15} />
                  {saving ? 'Saving...' : editing ? 'Update Car' : 'Add Car'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AdminLayout>
  )
}
