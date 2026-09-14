import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const SUPPORT = 'info@evolvepharmacy.com'

export default function ReturnPolicyPage() {
  return (
    <div className="orders-page-shell" style={{ maxWidth: 900 }}>
      <Link to="/" className="checkout-back" style={{ textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft size={15} /> Back to Home
      </Link>

      <h1 className="checkout-page-title">Return Policy</h1>
      <p className="checkout-page-sub" style={{ marginBottom: 28 }}>
        Last updated: {new Date().toLocaleDateString()} · 14-day return window for eligible items
      </p>

      <div className="checkout-card" style={{ fontSize: 15, lineHeight: 1.75, color: 'rgba(255,255,255,0.85)' }}>
        <p style={{ marginBottom: 18 }}>
          At Evolve Specialty Pharmacy &amp; Wellness, your satisfaction matters. We also must protect patient safety
          and pharmacy compliance. Please read this policy carefully before requesting a return.
        </p>

        <h2 style={{ fontSize: 18, color: '#fff', margin: '28px 0 12px' }}>14-day return guarantee</h2>
        <p style={{ marginBottom: 18 }}>
          For eligible online wellness / OTC merchandise, you may request a return within <strong>14 days of delivery</strong>
          (or pickup date for pharmacy pickup orders). Returns are only finalized <strong>after we receive and inspect</strong>
          the product at our San Antonio pharmacy.
        </p>

        <h2 style={{ fontSize: 18, color: '#fff', margin: '28px 0 12px' }}>How to start a return</h2>
        <ol style={{ margin: '0 0 18px', paddingLeft: 20 }}>
          <li>Email <a href={`mailto:${SUPPORT}`} style={{ color: 'var(--brand-primary-light)' }}>{SUPPORT}</a> with your order number and reason.</li>
          <li>Wait for written approval and return instructions before shipping anything back.</li>
          <li>Ship the item securely. Keep your carrier tracking receipt.</li>
          <li>After we receive the package and complete inspection, we process an eligible refund to the original payment method.</li>
        </ol>

        <h2 style={{ fontSize: 18, color: '#fff', margin: '28px 0 12px' }}>What we do not accept</h2>
        <ul style={{ margin: '0 0 18px', paddingLeft: 20 }}>
          <li><strong>Opened, used, or unsealed products</strong> (including broken seals, missing inner seals, or used applicators).</li>
          <li>Products not in original packaging, or missing labels, inserts, or accessories.</li>
          <li>Items damaged by misuse, improper storage, or return shipping without adequate packaging.</li>
          <li>Clearance / final-sale items marked as non-returnable at checkout.</li>
          <li><strong>Prescription medications</strong> and dispensed Rx products (federal/state pharmacy rules generally prohibit returns once dispensed).</li>
          <li>Temperature-sensitive, refrigerated, or compounded items unless we shipped an error or defective product.</li>
          <li>Returns requested after the 14-day window.</li>
        </ul>

        <h2 style={{ fontSize: 18, color: '#fff', margin: '28px 0 12px' }}>Refunds</h2>
        <p style={{ marginBottom: 18 }}>
          Approved refunds are issued only after the product arrives at our pharmacy and passes inspection.
          Original shipping fees are non-refundable unless the return is due to our error (wrong item, damaged in transit from us, or defective on arrival).
          Return shipping is the customer’s responsibility unless we authorize a prepaid label for a verified our-error case.
        </p>

        <h2 style={{ fontSize: 18, color: '#fff', margin: '28px 0 12px' }}>Damaged or incorrect shipments</h2>
        <p style={{ marginBottom: 18 }}>
          Contact us within <strong>48 hours of delivery</strong> with photos of the package and product. We will arrange a replacement or refund when the issue is verified.
        </p>

        <h2 style={{ fontSize: 18, color: '#fff', margin: '28px 0 12px' }}>Pharmacy discretion</h2>
        <p style={{ marginBottom: 18 }}>
          Evolve Specialty Pharmacy &amp; Wellness reserves the right to refuse any return that does not meet this policy,
          that presents a safety or compliance risk, or that appears fraudulent. Policies may be updated to remain consistent
          with Texas Board of Pharmacy and applicable federal rules.
        </p>

        <p style={{ marginTop: 28 }}>
          Questions? Email <a href={`mailto:${SUPPORT}`} style={{ color: 'var(--brand-primary-light)' }}>{SUPPORT}</a>
          or call the pharmacy during business hours.
        </p>
      </div>
    </div>
  )
}
