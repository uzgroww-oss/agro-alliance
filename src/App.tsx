import { lazy, Suspense, useEffect, useRef, type ReactNode } from "react"
import { BrowserRouter, HashRouter, Routes, Route, Outlet, Navigate, useLocation, useNavigate } from "react-router-dom"
import { App as CapApp } from "@capacitor/app"
import { isNative } from "./lib/platform"
import { AuthProvider, useAuth } from "./lib/auth"
import { I18nProvider } from "./lib/i18n"
import { ErrorBoundary } from "./lib/error-boundary"
import Header from "./components/Header"
import Footer from "./components/Footer"
import Home from "./pages/Home"
import { roleHome } from "./lib/roles"

/**
 * SAHIFALAR TALAB BO'YICHA YUKLANADI.
 *
 * NEGA: ilgari hamma sahifa bitta faylga yig'ilardi — 1.25 MB
 * (gzip 325 KB). Bosh sahifaga kirgan oddiy mehmon ham butun admin
 * panelini (3000 qator), bloger va hamkor panellarini yuklab olardi.
 * Endi har sahifa alohida bo'lak: kerak bo'lgandagina yuklanadi.
 *
 * Home KECHIKTIRILMAYDI — u birinchi ochiladigan sahifa, uni
 * bo'lakka ajratish faqat qo'shimcha kutish qo'shadi.
 */
const About = lazy(() => import("./pages/About"))
const Bloggers = lazy(() => import("./pages/Bloggers"))
const BloggerProfile = lazy(() => import("./pages/BloggerProfile"))
const Platform = lazy(() => import("./pages/Platform"))
const News = lazy(() => import("./pages/News"))
const NewsDetail = lazy(() => import("./pages/NewsDetail"))
const Partners = lazy(() => import("./pages/Partners"))
const Contact = lazy(() => import("./pages/Contact"))
const Login = lazy(() => import("./pages/Login"))
const ResetPassword = lazy(() => import("./pages/ResetPassword"))
const Terms = lazy(() => import("./pages/Terms"))
const Privacy = lazy(() => import("./pages/Privacy"))
const NotFound = lazy(() => import("./pages/NotFound"))
const BloggerDashboard = lazy(() => import("./pages/dashboard/BloggerDashboard"))
const AdminDashboard = lazy(() => import("./pages/dashboard/AdminDashboard"))
const PartnerDashboard = lazy(() => import("./pages/dashboard/PartnerDashboard"))

/** Sahifa bo'lagi yuklanayotganda ko'rinadi — bo'sh oq ekran bo'lmasin */
function PageLoading() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-green/30 border-t-green" />
        Yuklanmoqda…
      </div>
    </div>
  )
}

// Native ilovada HashRouter ishonchli (WebView'da server-side route yo'q), web'da BrowserRouter
const Router = isNative ? HashRouter : BrowserRouter

/** Android "orqaga" tugmasi: ichkarida — orqaga, ildizda — ilovadan chiqish */
function AndroidBackButton() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const pathRef = useRef(pathname)
  pathRef.current = pathname
  useEffect(() => {
    if (!isNative) return
    let remove: (() => void) | undefined
    CapApp.addListener("backButton", ({ canGoBack }) => {
      const root = ["/kirish", "/dashboard", "/admin", "/hamkor"].includes(pathRef.current)
      if (canGoBack && !root) navigate(-1)
      else CapApp.exitApp()
    }).then((h) => { remove = () => h.remove() })
    return () => remove?.()
  }, [navigate])
  return null
}

function ScrollToTop() {
  const { pathname } = useLocation()
  const prevPath = useRef(pathname)
  useEffect(() => {
    if (prevPath.current !== pathname) {
      window.scrollTo(0, 0)
      prevPath.current = pathname
    }
  }, [pathname])
  return null
}

function MainLayout() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}

function RequireRole({ role, children }: { role: "superadmin" | "blogger" | "partner"; children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="grid min-h-screen place-items-center text-muted">Yuklanmoqda…</div>
  if (!user) return <Navigate to="/kirish" replace />
  if (user.role !== role) return <Navigate to={roleHome(user.role)} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <I18nProvider>
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <AndroidBackButton />
        <ErrorBoundary>
        {/* Suspense — kechiktirilgan sahifa yuklanguncha spinner */}
        <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route element={<MainLayout />}>
            {/* Native ilovada bosh sahifa emas — login ekraniga yo'naltiramiz */}
            <Route path="/" element={isNative ? <Navigate to="/kirish" replace /> : <Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/blogerlar" element={<Bloggers />} />
            <Route path="/blogerlar/:slug" element={<BloggerProfile />} />
            <Route path="/platforma" element={<Platform />} />
            <Route path="/yangiliklar" element={<News />} />
          <Route path="/yangiliklar/:slug" element={<NewsDetail />} />
            <Route path="/hamkorlar" element={<Partners />} />
            <Route path="/aloqa" element={<Contact />} />
          <Route path="/shartlar" element={<Terms />} />
          <Route path="/maxfiylik" element={<Privacy />} />
          </Route>
            <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/kirish" element={<Login />} />
          <Route path="/dashboard" element={<RequireRole role="blogger"><BloggerDashboard /></RequireRole>} />
          <Route path="/admin" element={<RequireRole role="superadmin"><AdminDashboard /></RequireRole>} />
          <Route path="/hamkor" element={<RequireRole role="partner"><PartnerDashboard /></RequireRole>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </Router>
    </AuthProvider>
    </I18nProvider>
  )
}
