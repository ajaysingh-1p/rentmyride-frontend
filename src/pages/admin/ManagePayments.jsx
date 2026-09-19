import { useEffect, useState } from 'react'
import { paymentService, invoiceService } from '../../services/allServices'
import AdminLayout from '../../components/layout/AdminLayout'
import { formatCurrency, formatDateTime, getBadgeClass, getStatusInfo } from '../../utils/helpers'
import { PAYMENT_STATUS, PAYMENT_METHODS } from '../../utils/constants'
import { FiSearch, FiX, FiEye, FiDollarSign, FiDownload } from 'react-icons/fi'
import toast from 'react-hot-toast'

export default function ManagePayments() {
  const [payments,  setPayments]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState('')
  const [downloadingInvoice, setDownloadingInvoice] = useState(false)

  const downloadInvoice = async (rentalId) => {
    // Bug fix: a Payment made at BOOKING time (deposit/full payment before the trip even starts)
    // has no rentalId at all — a Rental only exists once the driver actually picks up the car,
    // and an invoice only exists once the driver drops off. This button used to fire regardless
    // and call invoiceService.getByRental(null) then invoiceService.generate(null), both of
    // which are guaranteed to fail — hence the generic "Could not generate/download invoice."
    // toast on every attempt for a still-in-progress booking's payment record.
    if (!rentalId) {
      toast.error('No invoice yet — this payment is for a booking whose trip hasn\'t completed.')
      return
    }
    setDownloadingInvoice(true)
    try {
      let invoiceRes = await invoiceService.getByRental(rentalId).catch(() => null)
      let invoice = invoiceRes?.data?.data
      if (!invoice) {
        const genRes = await invoiceService.generate(rentalId)
        invoice = genRes.data.data
      }
      const pdfRes = await invoiceService.download(invoice.invoiceId)
      const url = window.URL.createObjectURL(new Blob([pdfRes.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'invoice-' + invoice.invoiceNumber + '.pdf'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Could not generate/download invoice.')
    } finally {
      setDownloadingInvoice(false)
    }
  }
  const [selected,  setSelected]  = useState(null)

  useEffect(() => { fetchPayments() }, [])

  const fetchPayments = async () => {
    setLoading(true)
    try {
      const res = await paymentService.getAll()
      setPayments(res.data.data || [])
    } catch { } finally { setLoading(false) }
  }

  const totalCollected = payments
    .filter(p => p.paymentStatus === 'SUCCESS')
    .reduce((s, p) => s + (p.totalAmount || 0), 0)

  const filtered = payments.filter(p => {
    const matchFilter = !filter || p.paymentStatus === filter
    const matchSearch = !search || p.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      p.razorpayOrderId?.includes(search) || p.razorpayPaymentId?.includes(search)
    return matchFilter && matchSearch
  })

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="page-title">Manage Payments</h2>
          <p className="text-gray-500 text-sm">{payments.length} total transactions</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-center">
          <p className="text-xs text-green-600 font-semibold">Total Collected</p>
          <p className="text-green-700 font-bold text-xl">{formatCurrency(totalCollected)}</p>
        </div>
      </div>

      {/* Status Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {PAYMENT_STATUS.map(s => (
          <div key={s.value}
            onClick={() => setFilter(filter === s.value ? '' : s.value)}
            className={'bg-white rounded-xl p-3 border-2 text-center cursor-pointer transition-all ' +
              (filter === s.value ? 'border-orange-400' : 'border-gray-100 hover:border-gray-200')}>
            <p className="text-xl font-bold text-gray-800">
              {payments.filter(p => p.paymentStatus === s.value).length}
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
            className="form-input pl-9" placeholder="Search customer or order ID..." />
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
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>#ID</th><th>Customer</th><th>Method</th>
                <th>Base</th><th>GST</th><th>Total</th>
                <th>Date</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const s = getStatusInfo(PAYMENT_STATUS, p.paymentStatus)
                return (
                  <tr key={p.paymentId}>
                    <td className="font-mono text-xs text-gray-400">#{p.paymentId}</td>
                    <td className="text-sm font-semibold text-gray-800">{p.customerName}</td>
                    <td>
                      <span className="badge-gray text-xs">{p.paymentMethod?.replace('_',' ')}</span>
                    </td>
                    <td className="text-sm text-gray-600">{formatCurrency(p.baseAmount)}</td>
                    <td className="text-sm text-gray-500">{formatCurrency(p.gstAmount)}</td>
                    <td className="font-bold text-orange-500">{formatCurrency(p.totalAmount)}</td>
                    <td className="text-xs text-gray-500">{formatDateTime(p.paymentDatetime)}</td>
                    <td><span className={getBadgeClass(s.color)}>{s.label}</span></td>
                    <td>
                      <button onClick={() => setSelected(p)}
                        className="w-7 h-7 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-center text-blue-500">
                        <FiEye size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <h3 className="font-bold text-gray-800">Payment #{selected.paymentId}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><FiX size={22} /></button>
            </div>
            <div className="p-6 space-y-2">
              {[
                ['Customer',       selected.customerName],
                ['Rental ID',      selected.rentalId ? '#' + selected.rentalId : 'Not started yet'],
                ['Method',         selected.paymentMethod?.replace('_',' ')],
                ['Razorpay Order', selected.razorpayOrderId || '—'],
                ['Razorpay Pay ID',selected.razorpayPaymentId || '—'],
                ['Base Amount',    formatCurrency(selected.baseAmount)],
                ['GST (18%)',      formatCurrency(selected.gstAmount)],
                ['Total Amount',   formatCurrency(selected.totalAmount)],
                ['Status',         selected.paymentStatus],
                ['Payment Time',   formatDateTime(selected.paymentDatetime)],
                ['Failure Reason', selected.failureReason || '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-400 text-sm">{label}</span>
                  <span className="text-gray-800 text-sm font-medium text-right max-w-48 break-all">{value}</span>
                </div>
              ))}
              {selected.rentalId ? (
                <button onClick={() => downloadInvoice(selected.rentalId)} disabled={downloadingInvoice}
                  className="btn-primary w-full py-2.5 mt-3 flex items-center justify-center gap-2 disabled:opacity-60">
                  <FiDownload size={14} /> {downloadingInvoice ? 'Preparing...' : 'View / Download Invoice'}
                </button>
              ) : (
                <p className="text-xs text-gray-400 text-center mt-3">
                  Invoice will be available once this booking's trip is completed.
                </p>
              )}
              <button onClick={() => setSelected(null)} className="btn-gray w-full py-2.5 mt-2">Close</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
