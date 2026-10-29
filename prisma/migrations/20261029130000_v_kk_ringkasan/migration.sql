-- Ringkasan KK untuk tabel Data KK (PRD 8.2): kepala keluarga dan jumlah anggota aktif.
-- Nama kepala keluarga tidak disimpan di kartu_keluarga; diambil dari warga berhubungan
-- KEPALA_KELUARGA yang masih aktif (BR-06: kepala Pindah/Meninggal berarti NULL).
CREATE VIEW v_kk_ringkasan AS
SELECT
  kk.id AS kartu_keluarga_id,
  (
    SELECT w.nama_lengkap
    FROM warga w
    WHERE w.kartu_keluarga_id = kk.id
      AND w.hubungan_keluarga = 'KEPALA_KELUARGA'
      AND w.status_kependudukan = 'AKTIF'
      AND w.deleted_at IS NULL
    LIMIT 1
  ) AS kepala_keluarga,
  (
    SELECT count(*)::int
    FROM warga w
    WHERE w.kartu_keluarga_id = kk.id
      AND w.status_kependudukan = 'AKTIF'
      AND w.deleted_at IS NULL
  ) AS jumlah_anggota
FROM kartu_keluarga kk
WHERE kk.deleted_at IS NULL;
