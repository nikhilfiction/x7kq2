import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import AccuracyPage from './pages/AccuracyPage'
import ForecastPage from './pages/ForecastPage'
import { NotFoundPage, PrivacyPage, TermsPage } from './pages/LegalPages'
import MethodPage from './pages/MethodPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ForecastPage />} />
        <Route path="accuracy" element={<AccuracyPage />} />
        <Route path="method" element={<MethodPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
