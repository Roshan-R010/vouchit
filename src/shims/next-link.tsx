import React from "react";
import { Link as RouterLink, NavLink as RouterNavLink } from "react-router-dom";

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  children?: React.ReactNode;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, prefetch, ...props },
  ref
) {
  // If it's an external link or anchor hash, render standard a tag
  if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) {
    return (
      <a ref={ref} href={href} {...props}>
        {children}
      </a>
    );
  }

  return (
    <RouterLink ref={ref} to={href} {...props}>
      {children}
    </RouterLink>
  );
});

export default Link;
