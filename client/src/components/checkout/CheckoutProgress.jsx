import { Check } from 'lucide-react'

const DEFAULT_STEPS = [
  { id: 'cart', label: 'Cart' },
  { id: 'details', label: 'Details' },
  { id: 'payment', label: 'Payment' },
  { id: 'confirmed', label: 'Confirmed' },
]

/**
 * Horizontal checkout progress indicator.
 * @param {string} current — step id that is active
 * @param {Array<{id:string,label:string}>} [steps]
 */
export default function CheckoutProgress({ current = 'details', steps = DEFAULT_STEPS }) {
  const currentIndex = Math.max(0, steps.findIndex((s) => s.id === current))

  return (
    <nav className="checkout-progress" aria-label="Checkout progress">
      <ol className="checkout-progress-list">
        {steps.map((step, index) => {
          const done = index < currentIndex
          const active = index === currentIndex
          return (
            <li
              key={step.id}
              className={`checkout-progress-step${done ? ' is-done' : ''}${active ? ' is-active' : ''}`}
              aria-current={active ? 'step' : undefined}
            >
              <span className="checkout-progress-dot" aria-hidden="true">
                {done ? <Check size={14} strokeWidth={3} /> : index + 1}
              </span>
              <span className="checkout-progress-label">{step.label}</span>
              {index < steps.length - 1 && (
                <span
                  className={`checkout-progress-connector${done ? ' is-done' : ''}`}
                  aria-hidden="true"
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
