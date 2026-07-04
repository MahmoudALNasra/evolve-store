import { useNavigate } from 'react-router-dom'
import { canNavigateBack } from '../lib/scrollRestoration'

export function useSmartBack(fallbackPath = '/shop') {
  const navigate = useNavigate()

  return () => {
    if (canNavigateBack()) {
      navigate(-1)
      return
    }
    navigate(fallbackPath)
  }
}
