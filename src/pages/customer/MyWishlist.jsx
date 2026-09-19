import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { wishlistService } from '../../services/allServices'
import { resolveFileUrl } from '../../services/api'
import CustomerLayout from '../../components/layout/CustomerLayout'
import { formatCurrency } from '../../utils/helpers'
import { FiHeart, FiUsers, FiZap } from 'react-icons/fi'

export default function MyWishlist() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchWishlist() }, [])

  const fetchWishlist = () => {
    setLoading(true)
    wishlistService.getAll(user.userId)
      .then(res => setCars(res.data.data || []))
      .catch(() => toast.error('Failed to load wishlist.'))
      .finally(() => setLoading(false))
  }

  const handleRemove = async (e, carId) => {
    e.stopPropagation()
    try {
      await wishlistService.remove(user.userId, carId)
      setCars(prev => prev.filter(c => c.carId !== carId))
      toast.success('Removed from wishlist.')
    } catch {
      toast.error('Failed to remove.')
    }
  }

  if (loading) {
    return (
      <CustomerLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded-2xl" />
        </div>
      </CustomerLayout>
    )
  }

  return (
    <CustomerLayout>
      <div className="mb-6">
        <h2 className="page-title flex items-center gap-2">
          <FiHeart className="text-red-500" /> My Wishlist
        </h2>
        <p className="text-gray-500 text-sm mt-1">Cars you've saved for later</p>
      </div>

      {cars.length === 0 ? (
        <div className="text-center py-20 card">
          <p className="text-5xl mb-4">💔</p>
          <p className="text-xl font-bold text-gray-700 mb-2">No saved cars yet</p>
          <p className="text-gray-400 text-sm mb-5">Tap the ❤️ icon on any car to save it here.</p>
          <button onClick={() => navigate('/customer/cars')} className="btn-primary px-6 py-2.5">
            Browse Cars
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {cars.map(car => (
            <div key={car.carId}
              onClick={() => navigate('/customer/cars/' + car.carId)}
              className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg
                         transition-all duration-300 border border-gray-100 cursor-pointer group">
              <div className="relative h-44 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                {car.imageUrl ? (
                  <img src={resolveFileUrl(car.imageUrl)} alt={car.brand + ' ' + car.model}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-6xl opacity-20">🚗</span>
                  </div>
                )}
                <button onClick={e => handleRemove(e, car.carId)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-red-500 text-white
                             flex items-center justify-center hover:bg-red-600 transition-all">
                  <FiHeart size={15} className="fill-current" />
                </button>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-gray-800 text-base">{car.brand} {car.model}</h3>
                <p className="text-gray-400 text-xs mb-2">{car.year} • {car.carCategory?.replace('_', ' ')}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1"><FiUsers size={12} /> {car.seatingCapacity} seats</span>
                  <span className="flex items-center gap-1"><FiZap size={12} /> {car.fuelType}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-500 font-bold text-lg">{formatCurrency(car.rentPerDay)}</p>
                    <p className="text-gray-400 text-xs">per day (local)</p>
                  </div>
                  <button className="btn-primary text-xs px-4 py-2">View</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </CustomerLayout>
  )
}
