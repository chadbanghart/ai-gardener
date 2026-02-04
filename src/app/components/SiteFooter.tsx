export default function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <div className="siteFooterBrand">
          <span className="siteFooterLogo">AI Garden</span>
          <span className="siteFooterTag">
            Calm, local-first guidance for every season.
          </span>
        </div>

        <div className="siteFooterMeta">
          <span>Built for mindful plant care.</span>
          <span>© {new Date().getFullYear()} AI Garden</span>
        </div>
      </div>
    </footer>
  );
}
