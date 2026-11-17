import React from 'react'

export default function UserAvatar({
  user,
  size = 32,
  showStatus = false,
  style = {},
  onClick
}) {
  const photo = user?.photoURL
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

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      onClick={onClick}
      title={user?.displayName ? `${user.displayName} (${user.email || ''})` : (user?.email || name)}
    >
      {photo ? (
        <img
          src={photo}
          alt={name}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '1.5px solid rgba(0,0,0,0.08)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            display: 'block',
          }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: bg,
            color: '#ffffff',
            fontWeight: 700,
            fontSize: Math.max(10, Math.floor(size * 0.42)),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            userSelect: 'none',
          }}
        >
          {initial}
        </div>
      )}
      {showStatus && (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: Math.max(8, Math.floor(size * 0.28)),
            height: Math.max(8, Math.floor(size * 0.28)),
            borderRadius: '50%',
            background: '#10b981',
            border: '1.5px solid var(--surface, #ffffff)',
          }}
        />
      )}
    </div>
  )
}
