import React, { useState } from 'react'

export default function UserAvatar({
  user,
  size = 32,
  showStatus = false,
  style = {},
  onClick
}) {
  const [imgError, setImgError] = useState(false)
  const photo = !imgError ? (user?.photoURL || null) : null
  const name = user?.displayName || user?.email || 'User'
  const initial = (name.trim() || 'U').charAt(0).toUpperCase()

  const gradients = [
    'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    'linear-gradient(135deg, #10b981 0%, #047857 100%)',
    'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
    'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
    'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)',
  ]
  const str = user?.uid || user?.id || name
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const bg = gradients[Math.abs(hash) % gradients.length]

  const statusSize = Math.max(9, Math.round(size * 0.26))

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        background: photo ? 'var(--surface, #ffffff)' : bg,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        ...style,
      }}
      onClick={onClick}
      title={user?.displayName ? `${user.displayName} (${user.email || ''})` : (user?.email || name)}
    >
      {photo ? (
        <img
          src={photo}
          alt={name}
          onError={() => setImgError(true)}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            objectFit: 'cover',
            display: 'block',
            border: '1.5px solid rgba(0,0,0,0.08)',
          }}
        />
      ) : (
        <span
          style={{
            color: '#ffffff',
            fontWeight: 700,
            fontSize: Math.max(10, Math.floor(size * 0.42)),
            userSelect: 'none',
            lineHeight: 1,
          }}
        >
          {initial}
        </span>
      )}
      {showStatus && (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: statusSize,
            height: statusSize,
            borderRadius: '50%',
            background: '#10b981',
            border: '2px solid var(--surface, #ffffff)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
          }}
        />
      )}
    </div>
  )
}
