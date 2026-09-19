import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { invoiceService } from '../../services/allServices'
import AdminLayout from '../../components/layout/AdminLayout'
import { formatCurrency, formatDate, getBadgeClass, getStatusInfo } from '../../utils/helpers'
import { FiSearch, FiX, FiEye, FiDownload } from 'react-icons/fi'

const INVOICE_STATUS = [
  { value: 'GENERATED', label: 'Generated', color: 'info'    },
  { value: 'PAID',      label: 'Paid',      color: 'success' },
  { value: 'UNPAID',    label: 'Unpaid',    color: 'warning' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'danger'  },
  { value: 'REFUNDED',  label: 'Refunded',  color: 'gray'    },
]

export default function ManageInvoices() {
  const [invoices,  setInvoices]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState('')
  const [selected,  setSelected]  = useState(null)
  const [downloading, setDownloading] = useState(null)

  useEffect(() => { fetchInvoices() }, [])

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const res = await invoiceService.getAll()
      setInvoices(res.data.data || [])
    } catch { } finally { setLoading(false) }
  }

  const handleDownload = async (invoice) => {
    setDownloading(invoice.invoiceId)
    try {
      const res = await invoiceService.download(invoice.invoiceId)
      const url  = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href  = url
      link.setAttribute('download', 'invoice-' + invoice.invoiceNumber + '.pdf')
      document.body.appendChild(link)
      link.click(); link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      // Bug fix: this used to be a silent `catch {}` — any failure (auth, not-found, a PDF-
      // generation bug) just did nothing, with zero feedback. Also, because this request uses
      // responseType:'blob' (needed for binary PDF data), a JSON *error* response comes back as
      // a Blob too — err.response.data.message doesn't work directly on it. Read the blob back
      // as text and parse it to recover the real backend error message.
      let message = 'Could not download invoice.'
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text()
          message = JSON.parse(text)?.message || message
        } catch { /* response wasn't JSON — keep the generic message */ }
      } else {
        message = err.response?.data?.message || message
      }
      toast.error(message)
    } finally { setDownloading(null) }
  }

  const totalRevenue = invoices
    .filter(i => i.invoiceStatus === 'PAID')
    .reduce((s, i) => s + (i.grandTotal || 0), 0)

  const filtered = invoices.filter(i => {
    const matchFilter = !filter || i.invoiceStatus === filter
    const matchSearch = !search ||
      i.invoiceNumber?.includes(search) ||
      i.customerName?.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="page-title">Manage Invoices</h2>
          <p className="text-gray-500 text-sm">{invoices.length} total invoices</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 text-center">
          <p className="text-xs text-green-600 font-semibold">Paid Revenue</p>
          <p className="text-green-700 font-bold text-xl">{formatCurrency(totalRevenue)}</p>
        </div>
      </div>

      {/* Status Stats */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-5">
        {INVOICE_STATUS.map(s => (
          <div key={s.value}
            onClick={() => setFilter(filter === s.value ? '' : s.value)}
            className={'bg-white rounded-xl p-3 border-2 text-center cursor-pointer transition-all ' +
              (filter === s.value ? 'border-orange-400' : 'border-gray-100 hover:border-gray-200')}>
            <p className="text-xl font-bold text-gray-800">
              {invoices.filter(i => i.invoiceStatus === s.value).length}
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
            className="form-input pl-9" placeholder="Search invoice number or customer..." />
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
                <th>Invoice No</th><th>Customer</th><th>Car</th>
                <th>Days</th><th>Subtotal</th><th>GST</th>
                <th>Grand Total</th><th>Date</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => {
                const s = getStatusInfo(INVOICE_STATUS, inv.invoiceStatus)
                return (
                  <tr key={inv.invoiceId}>
                    <td className="font-mono text-xs text-orange-600 font-semibold">
                      {inv.invoiceNumber}
                    </td>
                    <td className="text-sm font-semibold text-gray-800">{inv.customerName}</td>
                    <td>
                      <p className="text-sm text-gray-700">{inv.carBrand} {inv.carModel}</p>
                      <p className="text-xs text-gray-400">{inv.carRegistrationNumber}</p>
                    </td>
                    <td className="text-center text-sm text-gray-600">{inv.totalDays}</td>
                    <td className="text-sm text-gray-600">{formatCurrency(inv.subtotal)}</td>
                    <td className="text-sm text-gray-500">{formatCurrency(inv.totalGstAmount)}</td>
                    <td className="font-bold text-orange-500">{formatCurrency(inv.grandTotal)}</td>
                    <td className="text-xs text-gray-500">{formatDate(inv.invoiceDate)}</td>
                    <td><span className={getBadgeClass(s.color)}>{s.label}</span></td>
                    <td>
                      <div className="flex gap-1.5">
                        <button onClick={() => setSelected(inv)}
                          className="w-7 h-7 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-center text-blue-500">
                          <FiEye size={12} />
                        </button>
                        <button onClick={() => handleDownload(inv)}
                          disabled={downloading === inv.invoiceId}
                          className="w-7 h-7 bg-green-50 hover:bg-green-100 rounded-lg flex items-center justify-center text-green-500 disabled:opacity-50">
                          <FiDownload size={12} />
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

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <h3 className="font-bold text-gray-800">Invoice {selected.invoiceNumber}</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><FiX size={22} /></button>
            </div>
            <div className="p-6 space-y-2">
              {[
                ['Invoice No',    selected.invoiceNumber],
                ['Customer',      selected.customerName],
                ['Email',         selected.customerEmail],
                ['Mobile',        selected.customerMobile],
                ['Car',           selected.carBrand + ' ' + selected.carModel],
                ['Reg No',        selected.carRegistrationNumber],
                ['Rent/Day',      formatCurrency(selected.rentPerDay)],
                ['Total Days',    selected.totalDays + ' days'],
                ['Base Rent',     formatCurrency(selected.baseRentAmount)],
                ['Extra KM',      formatCurrency(selected.extraKmCharges || 0)],
                ['Damage',        formatCurrency(selected.damageCharges || 0)],
                ['Late Charges',  formatCurrency(selected.lateReturnCharges || 0)],
                ['Discount',      formatCurrency(selected.discountAmount || 0)],
                ['Subtotal',      formatCurrency(selected.subtotal)],
                ['CGST (9%)',     formatCurrency(selected.cgstAmount)],
                ['SGST (9%)',     formatCurrency(selected.sgstAmount)],
                ['Total GST',     formatCurrency(selected.totalGstAmount)],
                ['Grand Total',   formatCurrency(selected.grandTotal)],
                ['Invoice Date',  formatDate(selected.invoiceDate)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-400 text-sm">{label}</span>
                  <span className="text-gray-800 text-sm font-medium text-right">{value}</span>
                </div>
              ))}
              <div className="flex gap-3 pt-3">
                <button onClick={() => handleDownload(selected)}
                  className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                  <FiDownload size={14} /> Download PDF
                </button>
                <button onClick={() => setSelected(null)} className="btn-gray flex-1 py-2.5 text-sm">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
