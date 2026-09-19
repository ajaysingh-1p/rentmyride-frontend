import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supportService } from '../../services/allServices'
import AdminLayout from '../../components/layout/AdminLayout'
import { formatDate } from '../../utils/helpers'
import { FiMail, FiPhone, FiCheckCircle, FiInbox } from 'react-icons/fi'

export default function ManageSupport() {
  const [queries, setQueries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('unresolved') // 'unresolved' | 'all'
  const [resolving, setResolving] = useState(null)

  useEffect(() => { fetchQueries() }, [filter])

  const fetchQueries = () => {
    setLoading(true)
    const call = filter === 'unresolved' ? supportService.getUnresolvedQueries() : supportService.getAllQueries()
    call.then(res => setQueries(res.data.data || []))
      .catch(() => toast.error('Could not load support queries.'))
      .finally(() => setLoading(false))
  }

  const handleResolve = async (queryId) => {
    setResolving(queryId)
    try {
      await supportService.resolveQuery(queryId)
      toast.success('Marked resolved.')
      setQueries(prev => filter === 'unresolved'
        ? prev.filter(q => q.queryId !== queryId)
        : prev.map(q => q.queryId === queryId ? { ...q, resolved: true } : q))
    } catch {
      toast.error('Failed to update.')
    } finally {
      setResolving(null)
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl">
        <div className="page-title mb-2">Help & Support</div>
        <p className="text-gray-500 text-sm mb-6">Messages sent by customers and drivers through the Support page.</p>

        <div className="flex bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          {[['unresolved', 'Unresolved'], ['all', 'All']].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className={'px-5 py-2 rounded-lg text-sm font-semibold transition-all ' +
                (filter === key ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={'skeleton-' + i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : queries.length === 0 ? (
          <div className="text-center py-20 card">
            <FiInbox className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-xl font-bold text-gray-700 mb-1">
              {filter === 'unresolved' ? 'No unresolved queries' : 'No support queries yet'}
            </p>
            <p className="text-gray-400 text-sm">
              {filter === 'unresolved' ? "You're all caught up! 🎉" : 'Nothing has come in through the Support page.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {queries.map(q => (
              <div key={q.queryId} className="card">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 text-sm">{q.subject}</p>
                      <span className={'badge-gray text-[10px]'}>{q.senderRole}</span>
                      {q.resolved && <span className="badge-success text-[10px]">Resolved</span>}
                    </div>
                    <p className="text-gray-400 text-xs mt-1">
                      {q.senderName} • {formatDate(q.createdAt)}
                    </p>
                  </div>
                  {!q.resolved && (
                    <button onClick={() => handleResolve(q.queryId)} disabled={resolving === q.queryId}
                      className="flex items-center gap-1.5 text-xs text-green-600 border border-green-200
                                 hover:bg-green-50 px-3 py-1.5 rounded-lg transition-all flex-shrink-0 disabled:opacity-50">
                      <FiCheckCircle size={12} /> {resolving === q.queryId ? '...' : 'Mark Resolved'}
                    </button>
                  )}
                </div>
                <p className="text-gray-600 text-sm mb-3 whitespace-pre-wrap">{q.message}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {q.senderContact?.includes('@') ? <FiMail size={11} /> : <FiPhone size={11} />}
                  {q.senderContact}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
