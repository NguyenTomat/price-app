import { formatMoneyInput, onMoneyInputChange } from '../utils/moneyFormat'

/** Input số tiền — tự thêm dấu phẩy ngàn khi gõ */
export default function MoneyInput({ value, onChange, className = 'input', placeholder, style, disabled }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      style={{ ...style, fontFamily: 'var(--mono)', textAlign: 'right' }}
      placeholder={placeholder ?? '0'}
      disabled={disabled}
      value={formatMoneyInput(value)}
      onChange={e => onChange(onMoneyInputChange(e.target.value))}
    />
  )
}
