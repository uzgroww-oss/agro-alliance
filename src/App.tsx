import { useEffect, useRef, type ReactNode } from "react"
import { BrowserRouter, HashRouter, Routes, Route, Outlet, Navigate, useLocation, useNavigate } from "react-router-dom"
import { App as CapApp } from "@capacitor/app"
import { isNative } from "./lib/platform"
import { AuthProvider, useAuth } from "./lib/auth"
import { ErrorBoundary } from "./lib/error-boundary"
import Header from "./components/Header"
import Footer from "./components/Footer"
import Home from "./pages/Home"
import About from "./pages/About"
import Bloggers from "./pages/Bloggers"
import BloggerProfile from "./pages/BloggerProfile"
import Platform from "./pages/Platform"
import News from "./pages/News"
import NewsDetail from "./pages/NewsDetail"
import Partners from "./pages/Partners"
import Contact from "./pages/Contact"
import Login from "./pages/Login"
import ResetPassword from "./pages/ResetPassword"
import Terms from "./pages/Terms"
import Privacy from "./pages/Privacy"
import NotFound from "./pages/NotFound"
import BloggerDashboard from "./pages/dashboard/BloggerDashboard"
import AdminDashboard from "./pages/dashboard/AdminDashboard"
import PartnerDashboard from "./pages/dashboard/PartnerDashboard"
import { roleHome } from "./lib/roles"

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
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <AndroidBackButton />
        <ErrorBoundary>
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
        </ErrorBoundary>
      </Router>
    </AuthProvider>
  )
}
