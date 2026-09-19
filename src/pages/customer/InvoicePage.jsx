import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { invoiceService } from '../../services/allServices'
import CustomerLayout from '../../components/layout/CustomerLayout'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/helpers'
import { FiDownload, FiPrinter, FiArrowLeft, FiCheck } from 'react-icons/fi'

export default function InvoicePage() {
  const { invoiceId } = useParams()
  const navigate      = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    invoiceService.getById(invoiceId)
      .then(res => setInvoice(res.data.data))
      .catch(() => toast.error('Invoice not found.'))
      .finally(() => setLoading(false))
  }, [invoiceId])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await invoiceService.download(invoiceId)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'invoice-' + invoice.invoiceNumber + '.pdf')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Invoice downloaded!')
    } catch (err) {
      // Bug fix: same as admin's ManageInvoices.jsx — a blob-typed request's error response also
      // comes back as a Blob, so the real backend message needs to be read out of it manually.
      let message = 'Download failed.'
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text()
          message = JSON.parse(text)?.message || message
        } catch { /* not JSON — keep the generic message */ }
      } else {
        message = err.response?.data?.message || message
      }
      toast.error(message)
    } finally {
      setDownloading(false)
    }
  }

  const handlePrint = () => window.print()

  if (loading) return (
    <CustomerLayout>
      <div className="max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-96 bg-gray-200 rounded-2xl" />
      </div>
    </CustomerLayout>
  )

  if (!invoice) return (
    <CustomerLayout>
      <div className="text-center py-20">
        <p className="text-5xl mb-4">❌</p>
        <p className="text-xl font-bold text-gray-700">Invoice not found</p>
      </div>
    </CustomerLayout>
  )

  const statusColors = {
    GENERATED: 'badge-info', PAID: 'badge-success',
    UNPAID: 'badge-warning', CANCELLED: 'badge-danger', REFUNDED: 'badge-gray',
  }

  return (
    <CustomerLayout>
      <div className="max-w-3xl mx-auto">

        {/* Top Actions */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors text-sm font-medium">
            <FiArrowLeft /> Back
          </button>
          <div className="flex gap-3">
            <button onClick={handlePrint}
              className="btn-gray flex items-center gap-2 py-2.5 px-4 text-sm">
              <FiPrinter size={15} /> Print
            </button>
            <button onClick={handleDownload} disabled={downloading}
              className="btn-primary flex items-center gap-2 py-2.5 px-4 text-sm
                         disabled:opacity-60 disabled:cursor-not-allowed">
              <FiDownload size={15} />
              {downloading ? 'Downloading...' : 'Download PDF'}
            </button>
          </div>
        </div>

        {/* Invoice Card */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden" id="invoice-print">

          {/* Invoice Header */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-8 text-white">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center text-2xl">🚗</div>
                  <div>
                    <h2 className="text-xl font-bold">RentMyRide</h2>
                    <p className="text-gray-400 text-xs">Car Rental Services</p>
                  </div>
                </div>
                <p className="text-gray-400 text-xs">GSTIN: 27AABCD1234E1Z5</p>
                <p className="text-gray-400 text-xs">India</p>
              </div>
              <div className="text-right">
                <h1 className="text-3xl font-bold text-orange-400 mb-1">INVOICE</h1>
                <p className="text-gray-300 font-mono text-sm">{invoice.invoiceNumber}</p>
                <p className="text-gray-400 text-xs mt-2">Date: {formatDate(invoice.invoiceDate)}</p>
                <div className="mt-3">
                  <span className={statusColors[invoice.invoiceStatus] || 'badge-gray'}>
                    {invoice.invoiceStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8">

            {/* Bill To / Car Info */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Bill To</h4>
                <p className="font-bold text-gray-800">{invoice.customerName}</p>
                <p className="text-gray-500 text-sm">{invoice.customerEmail}</p>
                <p className="text-gray-500 text-sm">{invoice.customerMobile}</p>
                {invoice.customerAddress && (
                  <p className="text-gray-500 text-sm mt-1">{invoice.customerAddress}</p>
                )}
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Vehicle Details</h4>
                <p className="font-bold text-gray-800">{invoice.carBrand} {invoice.carModel}</p>
                <p className="text-gray-500 text-sm">Reg: {invoice.carRegistrationNumber}</p>
                <p className="text-gray-500 text-sm">Rental ID: #{invoice.rentalId}</p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="table-wrapper mb-6">
              <table className="table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th className="text-center">Days</th>
                    <th className="text-right">Rate/Day</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <p className="font-semibold text-gray-800">{invoice.carBrand} {invoice.carModel} Rental</p>
                      <p className="text-gray-400 text-xs">Car rental charges</p>
                    </td>
                    <td className="text-center">{invoice.totalDays}</td>
                    <td className="text-right">{formatCurrency(invoice.rentPerDay)}</td>
                    <td className="text-right font-semibold">{formatCurrency(invoice.baseRentAmount)}</td>
                  </tr>
                  {invoice.extraKmCharges > 0 && (
                    <tr>
                      <td>Extra KM Charges</td>
                      <td className="text-center">—</td>
                      <td className="text-right">—</td>
                      <td className="text-right text-red-500">{formatCurrency(invoice.extraKmCharges)}</td>
                    </tr>
                  )}
                  {invoice.damageCharges > 0 && (
                    <tr>
                      <td>Damage Charges</td>
                      <td className="text-center">—</td>
                      <td className="text-right">—</td>
                      <td className="text-right text-red-500">{formatCurrency(invoice.damageCharges)}</td>
                    </tr>
                  )}
                  {invoice.lateReturnCharges > 0 && (
                    <tr>
                      <td>Late Return Charges</td>
                      <td className="text-center">—</td>
                      <td className="text-right">—</td>
                      <td className="text-right text-red-500">{formatCurrency(invoice.lateReturnCharges)}</td>
                    </tr>
                  )}
                  {invoice.discountAmount > 0 && (
                    <tr>
                      <td>Discount</td>
                      <td className="text-center">—</td>
                      <td className="text-right">—</td>
                      <td className="text-right text-green-500">- {formatCurrency(invoice.discountAmount)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Tax & Total */}
            <div className="flex justify-end">
              <div className="w-72 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>CGST @ {invoice.cgstPercentage}%</span>
                  <span>{formatCurrency(invoice.cgstAmount)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>SGST @ {invoice.sgstPercentage}%</span>
                  <span>{formatCurrency(invoice.sgstAmount)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Total GST ({invoice.totalGstPercentage}%)</span>
                  <span>{formatCurrency(invoice.totalGstAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-800 text-base
                                border-t-2 border-gray-200 pt-3 mt-2">
                  <span>Grand Total</span>
                  <span className="text-orange-500 text-xl">{formatCurrency(invoice.grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Self-drive security deposit settlement — informational, kept separate from
                Grand Total above since the deposit was collected up front, not billed here. */}
            {invoice.depositHeld > 0 && (
              <div className="flex justify-end mt-3">
                <div className="w-72 space-y-1.5 text-sm bg-blue-50 rounded-xl p-4">
                  <p className="font-semibold text-blue-800 text-xs uppercase tracking-wide mb-1">
                    Security Deposit
                  </p>
                  <div className="flex justify-between text-gray-600">
                    <span>Deposit Held</span>
                    <span>{formatCurrency(invoice.depositHeld)}</span>
                  </div>
                  {invoice.depositRefunded > 0 && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Refunded to Wallet</span>
                      <span>{formatCurrency(invoice.depositRefunded)}</span>
                    </div>
                  )}
                  {invoice.depositAdjusted > 0 && (
                    <div className="flex justify-between text-red-600 font-medium">
                      <span>Charged Beyond Deposit</span>
                      <span>{formatCurrency(invoice.depositAdjusted)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {invoice.notes && (
              <div className="mt-6 bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Notes</p>
                <p className="text-gray-600 text-sm">{invoice.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
              <div className="text-xs text-gray-400 space-y-1">
                <p>Thank you for choosing RentMyRide!</p>
                <p>Har Safar, Aapke Saath 🙏</p>
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <FiCheck size={16} />
                <span className="text-xs font-semibold">Digitally Verified</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </CustomerLayout>
  )
}
