using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using Datum.Core.Aggregator;

namespace Datum.Core.Calibrator
{
    public class CalibrationSample
    {
        [JsonPropertyName("configId")]
        public int ConfigId { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("subjectiveScore")]
        public float SubjectiveScore { get; set; }   // 策划主观评分 1-10

        [JsonPropertyName("ehpNorm")]
        public float EHPNorm { get; set; }

        [JsonPropertyName("dpsNorm")]
        public float DPSNorm { get; set; }

        [JsonPropertyName("controlNorm")]
        public float ControlNorm { get; set; }
    }

    public class CalibrationResult
    {
        public float survival_weight { get; set; }
        public float damage_weight { get; set; }
        public float control_weight { get; set; }
        public float scaleFactor { get; set; }
        public float rSquared { get; set; }
        public float mse { get; set; }
        public string interpretation { get; set; }
    }

    /// <summary>
    /// 最小二乘法权重校准器（3×3 正规方程 + 克拉默法则求解）。
    /// </summary>
    public static class WeightCalibrator
    {
        public static CalibrationResult CalibrateWithScale(IList<CalibrationSample> samples)
        {
            if (samples == null || samples.Count < 3)
                return null;

            int n = samples.Count;

            // 构建矩阵 A^T A 和 A^T b（3个权重维度）
            double[,] ata = new double[3, 3];
            double[] atb = new double[3];

            foreach (var s in samples)
            {
                double[] x = { s.EHPNorm, s.DPSNorm, s.ControlNorm };
                double y = s.SubjectiveScore / 10.0;  // 归一化到 0-1

                for (int i = 0; i < 3; i++)
                {
                    atb[i] += x[i] * y;
                    for (int j = 0; j < 3; j++)
                        ata[i, j] += x[i] * x[j];
                }
            }

            // 克拉默法则求解 3×3 线性方程组
            double det = Det3(ata);
            if (Math.Abs(det) < 1e-10)
                return null;

            double w0 = Det3Replace(ata, atb, 0) / det;
            double w1 = Det3Replace(ata, atb, 1) / det;
            double w2 = Det3Replace(ata, atb, 2) / det;

            // 非负约束 + 归一化
            w0 = Math.Max(w0, 0);
            w1 = Math.Max(w1, 0);
            w2 = Math.Max(w2, 0);
            double wSum = w0 + w1 + w2;
            if (wSum < 1e-6) return null;

            float weightEHP     = (float)(w0 / wSum);
            float weightDPS     = (float)(w1 / wSum);
            float weightControl = (float)(w2 / wSum);

            // 计算缩放因子（使预测均值 = 主观均值）
            float scaleFactor = 1f;
            float predMean = 0f, subjMean = 0f;
            foreach (var s in samples)
            {
                predMean += weightEHP * s.EHPNorm + weightDPS * s.DPSNorm + weightControl * s.ControlNorm;
                subjMean += s.SubjectiveScore / 10f;
            }
            predMean /= n;
            subjMean /= n;
            if (predMean > 1e-6f) scaleFactor = subjMean / predMean;

            // R² 和 MSE
            float ssRes = 0f, ssTot = 0f;
            foreach (var s in samples)
            {
                float pred = scaleFactor * (weightEHP * s.EHPNorm + weightDPS * s.DPSNorm + weightControl * s.ControlNorm);
                float actual = s.SubjectiveScore / 10f;
                ssRes += (pred - actual) * (pred - actual);
                ssTot += (actual - subjMean) * (actual - subjMean);
            }
            float rSquared = ssTot > 1e-6f ? 1f - ssRes / ssTot : 0f;
            float mse = ssRes / n;

            return new CalibrationResult
            {
                survival_weight = weightEHP,
                damage_weight   = weightDPS,
                control_weight  = weightControl,
                scaleFactor     = scaleFactor,
                rSquared        = rSquared,
                mse             = mse,
                interpretation  = InterpretRSquared(rSquared),
            };
        }

        private static string InterpretRSquared(float r2)
        {
            if (r2 >= 0.9f) return "拟合优秀（R²≥0.9）";
            if (r2 >= 0.7f) return "拟合良好（R²≥0.7）";
            if (r2 >= 0.5f) return "拟合一般（R²≥0.5），建议增加校准样本";
            return "拟合较差（R²<0.5），样本可能存在主观评分不一致";
        }

        private static double Det3(double[,] m)
        {
            return m[0,0]*(m[1,1]*m[2,2]-m[1,2]*m[2,1])
                  -m[0,1]*(m[1,0]*m[2,2]-m[1,2]*m[2,0])
                  +m[0,2]*(m[1,0]*m[2,1]-m[1,1]*m[2,0]);
        }

        private static double Det3Replace(double[,] m, double[] b, int col)
        {
            double[,] tmp = (double[,])m.Clone();
            for (int i = 0; i < 3; i++) tmp[i, col] = b[i];
            return Det3(tmp);
        }
    }
}
