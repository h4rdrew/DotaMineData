interface ExternalLinkProps {
  href: string
  children: React.ReactNode
  className?: string
}

function ExternalLink({ href, children, className }: ExternalLinkProps): JSX.Element {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault() // impede navegação interna
    window.eShell.openExternal(href) // abre no navegador
  }

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  )
}

export default ExternalLink
