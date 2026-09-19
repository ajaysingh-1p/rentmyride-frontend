import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { supportService } from '../../services/allServices'
import CustomerLayout from '../../components/layout/CustomerLayout'
import { FiPhone, FiMail, FiClock, FiMapPin, FiChevronDown, FiSend } from 'react-icons/fi'

const FAQS = [
  {
    q: 'How do I cancel my booking?',
    a: 'Go to My Bookings, open the booking you want to cancel, and tap "Cancel Booking". Cancellation charges may apply depending on how close it is to your pickup date.',
  },
  {
    q: 'How is the final fare calculated?',
    a: 'For local (in-city) trips, a flat package rate covers up to 200 km — extra km beyond that is charged separately. For outstation trips, the fare is based on the actual distance driven at the car\'s per-km rate, plus a per-night charge for multi-day trips.',
  },
  {
    q: 'When do I pay the remaining balance?',
    a: 'Your booking usually requires a partial payment upfront. The exact fare is finalized once the driver completes drop-off (based on actual km driven), and any balance due shows on your booking\'s "My Bookings" page for you to pay.',
  },
  {
    q: 'Can I change my driver or pickup time?',
    a: 'Drivers are assigned by our team based on availability. If you need to change your pickup time or location, contact support as early as possible — changes close to the pickup time may not be possible.',
  },
  {
    q: 'What documents do I need to upload?',
    a: 'A valid driving license and Aadhar card photo are required for KYC verification — you can upload these anytime from your Profile page.',
  },
  {
    q: 'How do referral rewards work?',
    a: 'Share your referral code from the "Refer & Earn" page. When someone signs up and completes their first booking using your code, you both get rewarded.',
  },
]

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-gray-50 transition-colors">
        <span className="font-semibold text-gray-800 text-sm">{q}</span>
        <FiChevronDown className={'text-gray-400 flex-shrink-0 transition-transform ' + (open ? 'rotate-180' : '')} size={16} />
      </button>
      {open && <div className="px-4 pb-4 text-gray-500 text-sm leading-relaxed">{a}</div>}
    </div>
  )
}

export default function CustomerSupport() {
  const { user } = useAuth()
  const { register, handleSubmit, reset, formState: { errors } } = useForm()
  const [contact, setContact] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supportService.getContactInfo()
      .then(res => setContact(res.data.data))
      .catch(() => {})
  }, [])

  const onSubmit = async (data) => {
    setSubmitting(true)
    try {
      await supportService.submitQuery({
        userId: user.userId,
        role: 'CUSTOMER',
        subject: data.subject,
        message: data.message,
      })
      toast.success("Message sent! We'll get back to you soon. 🙏")
      reset()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send your message. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CustomerLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="page-title">Help & Support</h2>
          <p className="text-gray-500 text-sm">Find answers, or reach out — we're happy to help.</p>
        </div>

        {/* Contact Channels */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {/* Bug fix: when supportPhone/supportEmail aren't configured yet, href became
              `undefined` — clicking did visibly nothing with zero explanation. Now it always
              redirects when configured, and gives clear feedback (instead of silence) when not. */}
          <a href={contact?.supportPhone ? 'tel:' + contact.supportPhone : '#'}
            onClick={e => { if (!contact?.supportPhone) { e.preventDefault(); toast.error('Support phone number is not set up yet.') } }}
            className="card flex items-center gap-3 hover:border-orange-300 border border-transparent transition-all">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 flex-shrink-0">
              <FiPhone size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-gray-400 text-[11px]">Call Us</p>
              <p className="font-semibold text-gray-800 text-sm truncate">{contact?.supportPhone || 'Not available'}</p>
            </div>
          </a>
          <a href={contact?.supportEmail ? 'mailto:' + contact.supportEmail : '#'}
            onClick={e => { if (!contact?.supportEmail) { e.preventDefault(); toast.error('Support email is not set up yet.') } }}
            className="card flex items-center gap-3 hover:border-orange-300 border border-transparent transition-all">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 flex-shrink-0">
              <FiMail size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-gray-400 text-[11px]">Email Us</p>
              <p className="font-semibold text-gray-800 text-sm truncate">{contact?.supportEmail || 'Not available'}</p>
            </div>
          </a>
          <div className="card flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 flex-shrink-0">
              <FiClock size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-gray-400 text-[11px]">Support Hours</p>
              <p className="font-semibold text-gray-800 text-sm truncate">{contact?.supportHours || 'Loading...'}</p>
            </div>
          </div>
        </div>

        {contact?.address && (
          <div className="flex items-start gap-2 text-gray-500 text-xs mb-6 px-1">
            <FiMapPin size={13} className="mt-0.5 flex-shrink-0" /> {contact.address}
          </div>
        )}

        {/* FAQ */}
        <div className="card mb-6">
          <h3 className="section-title">❓ Frequently Asked Questions</h3>
          <div className="space-y-2">
            {FAQS.map(f => <FaqItem key={f.q} {...f} />)}
          </div>
        </div>

        {/* Contact Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4">
          <h3 className="section-title">✍️ Send Us a Message</h3>
          <div>
            <label className="form-label">Subject *</label>
            <input {...register('subject', { required: 'Required' })} className="form-input"
              placeholder="e.g. Question about my booking" />
            {errors.subject && <p className="form-error">{errors.subject.message}</p>}
          </div>
          <div>
            <label className="form-label">Message *</label>
            <textarea {...register('message', { required: 'Required' })} rows={4} className="form-input resize-none"
              placeholder="Describe your issue or question in detail..." />
            {errors.message && <p className="form-error">{errors.message.message}</p>}
          </div>
          <button type="submit" disabled={submitting}
            className="btn-primary py-2.5 px-6 flex items-center gap-2 disabled:opacity-60">
            <FiSend size={14} /> {submitting ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </CustomerLayout>
  )
}
