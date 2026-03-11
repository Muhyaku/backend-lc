// backend-lc/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = 'mongodb+srv://aryawidodo02_db_user:qbgaNEc5VNA7kXz5@learn-centre-1.2wpicvq.mongodb.net/ujian_intensif?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ DATABASE: Terhubung ke Atlas!'))
  .catch(err => console.error('❌ DATABASE: Gagal!', err));

const LatihanSchema = new mongoose.Schema({
  mapel: String, ujikomKe: Number, hariKe: Number, pertanyaan: String, opsi: [String], jawabanBenar: String, minWords: Number, expectedExplanation: String 
});

const LaporanSchema = new mongoose.Schema({
  tipe: String, mapel: String, ujikomKe: Number, hariKe: Number, soalTerkait: { type: mongoose.Schema.Types.ObjectId, ref: 'Latihan' }, pertanyaanTeks: String, jawabanAdik: String, penjelasanAdik: String, expectedExplanation: String, status: Boolean, revisiDede: String, tanggal: { type: Date, default: Date.now }
});

const Latihan = mongoose.model('Latihan', LatihanSchema);
const Laporan = mongoose.model('Laporan', LaporanSchema);

app.get('/api/stats', async (req, res) => {
  try {
    const stats = { mtk: { sisa: 0, selesai: 0, benar: 0, salah: 0 }, english: { sisa: 0, selesai: 0, benar: 0, salah: 0 } };
    stats.mtk.sisa = await Latihan.countDocuments({ mapel: 'mtk' });
    stats.english.sisa = await Latihan.countDocuments({ mapel: 'english' });

    const semuaLaporan = await Laporan.find();
    semuaLaporan.forEach(lap => {
      const mapel = lap.mapel.toLowerCase();
      if (stats[mapel]) {
        stats[mapel].selesai++;
        lap.status ? stats[mapel].benar++ : stats[mapel].salah++;
      }
    });
    res.json({ status: "success", data: stats });
  } catch (error) { res.status(500).json({ status: "error", message: error.message }); }
});

// AUTO-DETECT SESI PALING AWAL
app.get('/api/soal', async (req, res) => {
  try {
    const { mapel } = req.query;
    const filterMapel = mapel ? { mapel: mapel } : {};
    
    // Cari sesi (Ujikom & Hari) paling kecil yang masih ada soalnya
    const soalPalingAwal = await Latihan.findOne(filterMapel).sort({ ujikomKe: 1, hariKe: 1 });
    if (!soalPalingAwal) return res.status(404).json({ status: 'error', message: 'Semua soal di database sudah habis!' });

    // Kunci pencarian random hanya untuk sesi tersebut
    const filterSesiAktif = { ...filterMapel, ujikomKe: soalPalingAwal.ujikomKe, hariKe: soalPalingAwal.hariKe };
    
    const soal = await Latihan.aggregate([
      { $match: filterSesiAktif },
      { $sample: { size: 1 } }
    ]);

    // Hitung nomor urut soal di sesi aktif ini
    const jumlahSelesaiDiSesiIni = await Laporan.countDocuments(filterSesiAktif);
    
    res.json({ 
      status: "success", 
      data: soal[0], 
      urutan: jumlahSelesaiDiSesiIni + 1,
      sesiInfo: { ujikom: soalPalingAwal.ujikomKe, hari: soalPalingAwal.hariKe } 
    });
  } catch (error) { res.status(500).json({ status: "error", message: error.message }); }
});

app.post('/api/submit', async (req, res) => {
  try {
    const { soalId, jawaban, penjelasan } = req.body;
    const soalAsli = await Latihan.findById(soalId);
    if (!soalAsli) return res.status(404).json({ status: "error" });

    const isCorrect = (jawaban === soalAsli.jawabanBenar);
    
    // Pindahkan ke Laporan beserta cap Ujikom dan Hari nya
    const laporanBaru = new Laporan({
      tipe: 'Latihan Harian', mapel: soalAsli.mapel, ujikomKe: soalAsli.ujikomKe, hariKe: soalAsli.hariKe, soalTerkait: soalAsli._id, pertanyaanTeks: soalAsli.pertanyaan, jawabanAdik: jawaban, penjelasanAdik: penjelasan, expectedExplanation: soalAsli.expectedExplanation, status: isCorrect, revisiDede: "" 
    });
    
    await laporanBaru.save();
    await Latihan.findByIdAndDelete(soalId); // Hapus agar tidak looping
    res.json({ status: "success" });
  } catch (error) { res.status(500).json({ status: "error" }); }
});

app.get('/api/laporan', async (req, res) => {
  try {
    const dataLaporan = await Laporan.find().sort({ tanggal: 1 });
    res.json({ status: "success", data: dataLaporan });
  } catch (error) { res.status(500).json({ status: "error" }); }
});

// Tambahkan ini di baris paling bawah banget:
module.exports = app;

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 SERVER BERJALAN DI: http://localhost:${PORT}`));
