type BrandIdentityHeaderProps = {
  brand: { name: string; logoUrl?: string | null };
  eyebrow: string;
  title: string;
  description: string;
};

/** Brand heading shared by future customer and business portal views. */
export function BrandIdentityHeader({ brand, eyebrow, title, description }: BrandIdentityHeaderProps) {
  return <header className="brand-identity-header">
    <div className="brand-identity-mark">
      {brand.logoUrl ? <img src={brand.logoUrl} alt={`${brand.name} logo`}/> : <span aria-hidden="true">{brand.name.slice(0, 1).toUpperCase()}</span>}
    </div>
    <div className="brand-identity-copy">
      <span className="brand-identity-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  </header>;
}
