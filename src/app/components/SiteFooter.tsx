export default function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <span>© {new Date().getFullYear()} AI Garden</span>
      </div>
    </footer>
  );
}
