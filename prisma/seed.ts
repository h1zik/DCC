import {
  NotificationType,
  PrismaClient,
  PipelineStage,
  RoomMemberRole,
  RoomTaskProcess,
  RoomWorkspaceSection,
  StockLogType,
  TaskPriority,
  TaskStatus,
  UserRole,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEFAULT_CEO_EMAIL,
  hashDefaultCeoPassword,
} from "../src/lib/default-ceo-credentials";
import { ROOM_PROJECT_MANAGER_ROLE } from "../src/lib/room-member-process-access";

const ALL_ROOM_TASK_PROCESSES: RoomTaskProcess[] = [
  RoomTaskProcess.MARKET_RESEARCH,
  RoomTaskProcess.PRODUCT_DEVELOPMENT,
  RoomTaskProcess.BRAND_AND_DESIGN,
  RoomTaskProcess.PANEL_TESTING,
  RoomTaskProcess.PRE_LAUNCH,
  RoomTaskProcess.PRODUCTION,
];

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("dcc-demo-2026", 10);
  const ceoPasswordHash = await hashDefaultCeoPassword();

  await prisma.user.upsert({
    where: { email: DEFAULT_CEO_EMAIL },
    update: { passwordHash: ceoPasswordHash, role: UserRole.CEO },
    create: {
      email: DEFAULT_CEO_EMAIL,
      name: "CEO",
      passwordHash: ceoPasswordHash,
      role: UserRole.CEO,
    },
  });

  await prisma.user.upsert({
    where: { email: "admin@dominatus.local" },
    update: { passwordHash, role: UserRole.ADMINISTRATOR },
    create: {
      email: "admin@dominatus.local",
      name: "Administrator Demo",
      passwordHash,
      role: UserRole.ADMINISTRATOR,
    },
  });

  await prisma.user.upsert({
    where: { email: "logistics@dominatus.local" },
    update: { passwordHash, role: UserRole.LOGISTICS },
    create: {
      email: "logistics@dominatus.local",
      name: "Staf Logistik Demo",
      passwordHash,
      role: UserRole.LOGISTICS,
    },
  });

  const archipelago = await prisma.brand.upsert({
    where: { id: "seed-brand-archipelago" },
    update: {},
    create: {
      id: "seed-brand-archipelago",
      name: "Archipelago Scent",
      colorCode: "#0ea5e9",
      logo: null,
    },
  });

  const umella = await prisma.brand.upsert({
    where: { id: "seed-brand-umella" },
    update: {},
    create: {
      id: "seed-brand-umella",
      name: "Umella",
      colorCode: "#a855f7",
      logo: null,
    },
  });

  const divaon = await prisma.brand.upsert({
    where: { id: "seed-brand-divaon" },
    update: {},
    create: {
      id: "seed-brand-divaon",
      name: "Divaon",
      colorCode: "#22c55e",
      logo: null,
    },
  });

  await prisma.vendor.upsert({
    where: { id: "seed-vendor-1" },
    update: {},
    create: {
      id: "seed-vendor-1",
      name: "Maklon Aroma Nusantara",
      picName: "Budi Santoso",
      contact: "+62 812-0000-1111 · budi@aromanusantara.id",
      specialty: "Parfum & body mist",
    },
  });

  await prisma.vendor.upsert({
    where: { id: "seed-vendor-2" },
    update: {},
    create: {
      id: "seed-vendor-2",
      name: "CV Skincare Maklon Sejahtera",
      picName: "Rina Kusuma",
      contact: "rina@cssmaklon.co.id",
      specialty: "Skincare & krim",
    },
  });

  const products = [
    {
      sku: "ARC-EDP-001",
      name: "Archipelago EDP No.7",
      brandId: archipelago.id,
      currentStock: 0,
      minStock: 80,
      category: "Parfum",
      pipelineStage: PipelineStage.PRODUCTION,
    },
    {
      sku: "UME-SER-010",
      name: "Umella Bright Serum 30ml",
      brandId: umella.id,
      currentStock: 42,
      minStock: 60,
      category: "Skincare",
      pipelineStage: PipelineStage.PANEL_TESTING,
    },
    {
      sku: "DIV-MST-003",
      name: "Divaon Mist Citrus",
      brandId: divaon.id,
      currentStock: 200,
      minStock: 50,
      category: "Body mist",
      pipelineStage: PipelineStage.LAUNCH,
    },
    {
      sku: "ARC-RD-NEW",
      name: "Archipelago (R&D) — Oud line",
      brandId: archipelago.id,
      currentStock: 12,
      minStock: 0,
      category: "Parfum",
      pipelineStage: PipelineStage.PRODUCT_DEVELOPMENT,
    },
  ] as const;

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        brandId: p.brandId,
        currentStock: p.currentStock,
        minStock: p.minStock,
        category: p.category,
        pipelineStage: p.pipelineStage,
      },
      create: p,
    });
  }

  const serum = await prisma.product.findUniqueOrThrow({
    where: { sku: "UME-SER-010" },
  });

  const existingLogs = await prisma.stockLog.count({
    where: { productId: serum.id },
  });
  if (existingLogs === 0) {
    await prisma.stockLog.createMany({
      data: [
        {
          productId: serum.id,
          amount: 100,
          type: StockLogType.IN,
          note: "Batch produksi maklon — QC passed",
        },
        {
          productId: serum.id,
          amount: 58,
          type: StockLogType.OUT,
          note: "Penjualan marketplace",
        },
      ],
    });
  }

  await prisma.user.findUniqueOrThrow({
    where: { email: "logistics@dominatus.local" },
  });

  const marketingUser = await prisma.user.upsert({
    where: { email: "marketing@dominatus.local" },
    update: { passwordHash, role: UserRole.MARKETING },
    create: {
      email: "marketing@dominatus.local",
      name: "Marketing Demo",
      passwordHash,
      role: UserRole.MARKETING,
    },
  });

  await prisma.user.upsert({
    where: { email: "creative@dominatus.local" },
    update: { passwordHash, role: UserRole.CREATIVE_DIRECTOR },
    create: {
      email: "creative@dominatus.local",
      name: "Creative Director Demo",
      passwordHash,
      role: UserRole.CREATIVE_DIRECTOR,
    },
  });

  await prisma.user.upsert({
    where: { email: "analyst@dominatus.local" },
    update: { passwordHash, role: UserRole.BUSINESS_ANALYST },
    create: {
      email: "analyst@dominatus.local",
      name: "Business Analyst Demo",
      passwordHash,
      role: UserRole.BUSINESS_ANALYST,
    },
  });

  await prisma.user.upsert({
    where: { email: "copywriter@dominatus.local" },
    update: { passwordHash, role: UserRole.COPYWRITER },
    create: {
      email: "copywriter@dominatus.local",
      name: "Copywriter Demo",
      passwordHash,
      role: UserRole.COPYWRITER,
    },
  });

  await prisma.user.upsert({
    where: { email: "pm@dominatus.local" },
    update: { passwordHash, role: UserRole.PROJECT_MANAGER },
    create: {
      email: "pm@dominatus.local",
      name: "Project Manager Demo",
      passwordHash,
      role: UserRole.PROJECT_MANAGER,
    },
  });

  const roomArchipelago = await prisma.room.upsert({
    where: { id: "seed-room-archipelago" },
    update: {
      name: "Room Archipelago",
      brandId: archipelago.id,
      workspaceSection: RoomWorkspaceSection.HQ,
    },
    create: {
      id: "seed-room-archipelago",
      name: "Room Archipelago",
      brandId: archipelago.id,
      workspaceSection: RoomWorkspaceSection.HQ,
    },
  });

  const roomDivaon = await prisma.room.upsert({
    where: { id: "seed-room-divaon" },
    update: {
      name: "Room Divaon",
      brandId: divaon.id,
      workspaceSection: RoomWorkspaceSection.TEAM,
    },
    create: {
      id: "seed-room-divaon",
      name: "Room Divaon",
      brandId: divaon.id,
      workspaceSection: RoomWorkspaceSection.TEAM,
    },
  });

  const roomUmella = await prisma.room.upsert({
    where: { id: "seed-room-umella" },
    update: {
      name: "Room Umella",
      brandId: umella.id,
      workspaceSection: RoomWorkspaceSection.ROOMS,
    },
    create: {
      id: "seed-room-umella",
      name: "Room Umella",
      brandId: umella.id,
      workspaceSection: RoomWorkspaceSection.ROOMS,
    },
  });

  const pmUser = await prisma.user.findUniqueOrThrow({
    where: { email: "pm@dominatus.local" },
  });
  const creativeUser = await prisma.user.findUniqueOrThrow({
    where: { email: "creative@dominatus.local" },
  });
  const copywriterUser = await prisma.user.findUniqueOrThrow({
    where: { email: "copywriter@dominatus.local" },
  });
  const analystUser = await prisma.user.findUniqueOrThrow({
    where: { email: "analyst@dominatus.local" },
  });

  const roomMemberSeeds: {
    roomId: string;
    userId: string;
    role: RoomMemberRole;
    allowedRoomProcesses: RoomTaskProcess[];
  }[] = [
    {
      roomId: roomArchipelago.id,
      userId: pmUser.id,
      role: ROOM_PROJECT_MANAGER_ROLE,
      allowedRoomProcesses: [],
    },
    {
      roomId: roomArchipelago.id,
      userId: analystUser.id,
      role: RoomMemberRole.ROOM_MANAGER,
      allowedRoomProcesses: [...ALL_ROOM_TASK_PROCESSES],
    },
    {
      roomId: roomArchipelago.id,
      userId: marketingUser.id,
      role: RoomMemberRole.ROOM_CONTRIBUTOR,
      allowedRoomProcesses: [
        RoomTaskProcess.MARKET_RESEARCH,
        RoomTaskProcess.PRODUCT_DEVELOPMENT,
        RoomTaskProcess.PRE_LAUNCH,
      ],
    },
    {
      roomId: roomArchipelago.id,
      userId: creativeUser.id,
      role: RoomMemberRole.ROOM_CONTRIBUTOR,
      allowedRoomProcesses: [
        RoomTaskProcess.BRAND_AND_DESIGN,
        RoomTaskProcess.PANEL_TESTING,
      ],
    },
    {
      roomId: roomDivaon.id,
      userId: marketingUser.id,
      role: RoomMemberRole.ROOM_MANAGER,
      allowedRoomProcesses: [...ALL_ROOM_TASK_PROCESSES],
    },
    {
      roomId: roomDivaon.id,
      userId: copywriterUser.id,
      role: RoomMemberRole.ROOM_CONTRIBUTOR,
      allowedRoomProcesses: [...ALL_ROOM_TASK_PROCESSES],
    },
    {
      roomId: roomUmella.id,
      userId: analystUser.id,
      role: RoomMemberRole.ROOM_MANAGER,
      allowedRoomProcesses: [...ALL_ROOM_TASK_PROCESSES],
    },
    {
      roomId: roomUmella.id,
      userId: creativeUser.id,
      role: RoomMemberRole.ROOM_CONTRIBUTOR,
      allowedRoomProcesses: [...ALL_ROOM_TASK_PROCESSES],
    },
  ];

  for (const m of roomMemberSeeds) {
    await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: m.roomId, userId: m.userId } },
      update: {
        role: m.role,
        allowedRoomProcesses: m.allowedRoomProcesses,
      },
      create: {
        roomId: m.roomId,
        userId: m.userId,
        role: m.role,
        allowedRoomProcesses: m.allowedRoomProcesses,
      },
    } as never);
  }

  const vendor1 = await prisma.vendor.findUnique({
    where: { id: "seed-vendor-1" },
  });

  const projArch = await prisma.project.upsert({
    where: { id: "seed-proj-arch-summer" },
    update: {
      roomId: roomArchipelago.id,
      brandId: archipelago.id,
      name: "Archipelago Summer Drop 2026",
      currentStage: PipelineStage.BRAND_AND_DESIGN,
    },
    create: {
      id: "seed-proj-arch-summer",
      roomId: roomArchipelago.id,
      brandId: archipelago.id,
      name: "Archipelago Summer Drop 2026",
      currentStage: PipelineStage.BRAND_AND_DESIGN,
      stageEnteredAt: new Date(Date.now() - 6 * 86400000),
      totalProgress: 0,
    },
  });

  const projUm = await prisma.project.upsert({
    where: { id: "seed-proj-um-serum" },
    update: {
      roomId: roomUmella.id,
      brandId: umella.id,
      name: "Umella serum v2",
      currentStage: PipelineStage.PANEL_TESTING,
    },
    create: {
      id: "seed-proj-um-serum",
      roomId: roomUmella.id,
      brandId: umella.id,
      name: "Umella serum v2",
      currentStage: PipelineStage.PANEL_TESTING,
      stageEnteredAt: new Date(),
      totalProgress: 0,
    },
  });

  const projDiv = await prisma.project.upsert({
    where: { id: "seed-proj-divaon-mist" },
    update: {
      roomId: roomDivaon.id,
      brandId: divaon.id,
      name: "Divaon Mist Citrus — refresh",
      currentStage: PipelineStage.MARKET_RESEARCH,
    },
    create: {
      id: "seed-proj-divaon-mist",
      roomId: roomDivaon.id,
      brandId: divaon.id,
      name: "Divaon Mist Citrus — refresh",
      currentStage: PipelineStage.MARKET_RESEARCH,
      stageEnteredAt: new Date(),
      totalProgress: 0,
    },
  });

  await prisma.task.upsert({
    where: { id: "seed-task-approval-1" },
    update: {
      assigneeId: marketingUser.id,
      roomProcess: RoomTaskProcess.PRE_LAUNCH,
    },
    create: {
      id: "seed-task-approval-1",
      projectId: projArch.id,
      roomProcess: RoomTaskProcess.PRE_LAUNCH,
      title: "Final sample approval packaging",
      description: "Menunggu sign-off struktur karton premium",
      assigneeId: marketingUser.id,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      dueDate: new Date(Date.now() + 3 * 86400000),
      isApprovalRequired: true,
      isApproved: false,
      vendorId: vendor1?.id ?? undefined,
      leadTimeDays: 14,
      sortOrder: 1,
    },
  });

  await prisma.task.upsert({
    where: { id: "seed-task-rd-1" },
    update: {
      assigneeId: marketingUser.id,
      roomProcess: RoomTaskProcess.PRODUCT_DEVELOPMENT,
    },
    create: {
      id: "seed-task-rd-1",
      projectId: projArch.id,
      roomProcess: RoomTaskProcess.PRODUCT_DEVELOPMENT,
      title: "Stabilitas formula batch 3",
      assigneeId: marketingUser.id,
      status: TaskStatus.DONE,
      priority: TaskPriority.MEDIUM,
      dueDate: new Date(Date.now() - 1 * 86400000),
      sortOrder: 2,
    },
  });

  await prisma.task.upsert({
    where: { id: "seed-task-um-1" },
    update: {
      assigneeId: marketingUser.id,
      roomProcess: RoomTaskProcess.PANEL_TESTING,
    },
    create: {
      id: "seed-task-um-1",
      projectId: projUm.id,
      roomProcess: RoomTaskProcess.PANEL_TESTING,
      title: "Pengujian panel konsumen",
      assigneeId: marketingUser.id,
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      dueDate: new Date(Date.now() + 10 * 86400000),
      sortOrder: 1,
    },
  });

  await prisma.taskChecklistItem.upsert({
    where: { id: "seed-check-1" },
    update: {},
    create: {
      id: "seed-check-1",
      taskId: "seed-task-approval-1",
      title: "Kirim foto mockup ke maklon",
      done: true,
      sortOrder: 1,
    },
  });

  await prisma.taskChecklistItem.upsert({
    where: { id: "seed-check-2" },
    update: {},
    create: {
      id: "seed-check-2",
      taskId: "seed-task-approval-1",
      title: "CEO sign-off label depan/belakang",
      done: false,
      sortOrder: 2,
    },
  });

  const ceoUser = await prisma.user.findUnique({
    where: { email: DEFAULT_CEO_EMAIL },
  });
  if (ceoUser) {
    await prisma.notification.upsert({
      where: { id: "seed-notif-ceo-approval" },
      update: {
        isRead: false,
        message:
          "Persetujuan diminta: Final sample approval packaging (Archipelago Scent)",
      },
      create: {
        id: "seed-notif-ceo-approval",
        userId: ceoUser.id,
        message:
          "Persetujuan diminta: Final sample approval packaging (Archipelago Scent)",
        type: NotificationType.CEO_APPROVAL_REQUESTED,
      },
    });
  }

  for (const pid of [projArch.id, projUm.id, projDiv.id]) {
    const taskRows = await prisma.task.findMany({
      where: { projectId: pid },
      select: { status: true },
    });
    const done = taskRows.filter((t) => t.status === TaskStatus.DONE).length;
    const pct = taskRows.length
      ? Math.round((done / taskRows.length) * 100)
      : 0;
    await prisma.project.update({
      where: { id: pid },
      data: { totalProgress: pct },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
