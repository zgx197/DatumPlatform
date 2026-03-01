import { Routes, Route } from 'react-router-dom'
import ScoreDashboard from '../pages/ScoreDashboard'
import TemplateAnalysis from '../pages/TemplateAnalysis'
import WeightCalibration from '../pages/WeightCalibration'
import HealthReport from '../pages/HealthReport'
import LevelView from '../pages/LevelView'
import Settings from '../pages/Settings'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ScoreDashboard />} />
      <Route path="/templates" element={<TemplateAnalysis />} />
      <Route path="/calibration" element={<WeightCalibration />} />
      <Route path="/health" element={<HealthReport />} />
      <Route path="/levels" element={<LevelView />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  )
}
