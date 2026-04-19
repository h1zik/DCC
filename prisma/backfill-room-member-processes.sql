-- Jalankan setelah `prisma db push` menambahkan kolom `allowedRoomProcesses`.
-- Mengisi semua fase untuk manager & kontributor yang masih punya array kosong
-- (data lama sebelum CEO mengatur per fase). Project manager ruangan tetap [].

UPDATE "RoomMember"
SET "allowedRoomProcesses" = ARRAY[
  'MARKET_RESEARCH'::"RoomTaskProcess",
  'PRODUCT_DEVELOPMENT'::"RoomTaskProcess",
  'BRAND_AND_DESIGN'::"RoomTaskProcess",
  'PANEL_TESTING'::"RoomTaskProcess",
  'PRE_LAUNCH'::"RoomTaskProcess",
  'PRODUCTION'::"RoomTaskProcess"
]
WHERE role IN ('ROOM_MANAGER', 'ROOM_CONTRIBUTOR')
  AND cardinality("allowedRoomProcesses") = 0;
