-- Company permission templates and the grants copied onto each member.
-- OWNER is not stored: that role always has the full catalog.
-- permissions.manage is owner-only and is absent from both templates.
-- ADMIN template = every other catalog key.
-- USER template = visualizador (read/view keys, without management.view).
-- Existing ADMIN members receive the manageable set they already had.
-- Existing USER members keep their previous reads, the panel, and any
-- department screen already assigned to them. Later template edits do not
-- rewrite these rows.

-- CreateTable
CREATE TABLE "CompanyPermissionTemplate" (
    "tenantId" TEXT NOT NULL,
    "role" "RoleName" NOT NULL,
    "permissionKey" TEXT NOT NULL,

    CONSTRAINT "CompanyPermissionTemplate_pkey" PRIMARY KEY ("tenantId", "role", "permissionKey")
);

-- CreateTable
CREATE TABLE "MembershipPermissionGrant" (
    "membershipId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,

    CONSTRAINT "MembershipPermissionGrant_pkey" PRIMARY KEY ("membershipId", "permissionKey")
);

-- AddForeignKey
ALTER TABLE "CompanyPermissionTemplate" ADD CONSTRAINT "CompanyPermissionTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPermissionGrant" ADD CONSTRAINT "MembershipPermissionGrant_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill ADMIN and USER templates for companies that already exist.
INSERT INTO "CompanyPermissionTemplate" ("tenantId", "role", "permissionKey")
SELECT "Tenant"."id", 'ADMIN'::"RoleName", keys.key
FROM "Tenant"
CROSS JOIN (
    VALUES
        ('tenant.read'),
        ('tenant.manage'),
        ('users.read'),
        ('users.manage'),
        ('teams.read'),
        ('teams.manage'),
        ('teams.members.manage'),
        ('permissions.read'),
        ('logs.read'),
        ('dashboard.view'),
        ('management.view'),
        ('deliveries.view'),
        ('sales.view'),
        ('support.view'),
        ('reports.view')
) AS keys(key)
ON CONFLICT DO NOTHING;

INSERT INTO "CompanyPermissionTemplate" ("tenantId", "role", "permissionKey")
SELECT "Tenant"."id", 'USER'::"RoleName", keys.key
FROM "Tenant"
CROSS JOIN (
    VALUES
        ('tenant.read'),
        ('users.read'),
        ('teams.read'),
        ('permissions.read'),
        ('logs.read'),
        ('dashboard.view'),
        ('deliveries.view'),
        ('sales.view'),
        ('support.view'),
        ('reports.view')
) AS keys(key)
ON CONFLICT DO NOTHING;

-- Existing admins keep every manageable permission.
INSERT INTO "MembershipPermissionGrant" ("membershipId", "permissionKey")
SELECT "Membership"."id", keys.key
FROM "Membership"
INNER JOIN "Role" ON "Role"."id" = "Membership"."roleId"
CROSS JOIN (
    VALUES
        ('tenant.read'),
        ('tenant.manage'),
        ('users.read'),
        ('users.manage'),
        ('teams.read'),
        ('teams.manage'),
        ('teams.members.manage'),
        ('permissions.read'),
        ('logs.read'),
        ('dashboard.view'),
        ('management.view'),
        ('deliveries.view'),
        ('sales.view'),
        ('support.view'),
        ('reports.view')
) AS keys(key)
WHERE "Role"."name" = 'ADMIN'::"RoleName"
ON CONFLICT DO NOTHING;

-- Existing users keep the reads they already had, plus the panel.
INSERT INTO "MembershipPermissionGrant" ("membershipId", "permissionKey")
SELECT "Membership"."id", keys.key
FROM "Membership"
INNER JOIN "Role" ON "Role"."id" = "Membership"."roleId"
CROSS JOIN (
    VALUES
        ('tenant.read'),
        ('users.read'),
        ('teams.read'),
        ('dashboard.view')
) AS keys(key)
WHERE "Role"."name" = 'USER'::"RoleName"
ON CONFLICT DO NOTHING;

-- And any department screen that membership already received through a team.
INSERT INTO "MembershipPermissionGrant" ("membershipId", "permissionKey")
SELECT DISTINCT "TeamMembership"."membershipId", "TeamPermission"."key"
FROM "TeamMembership"
INNER JOIN "TeamPermissionAssignment"
    ON "TeamPermissionAssignment"."teamId" = "TeamMembership"."teamId"
INNER JOIN "TeamPermission"
    ON "TeamPermission"."id" = "TeamPermissionAssignment"."permissionId"
INNER JOIN "Membership" ON "Membership"."id" = "TeamMembership"."membershipId"
INNER JOIN "Role" ON "Role"."id" = "Membership"."roleId"
WHERE "Role"."name" = 'USER'::"RoleName"
ON CONFLICT DO NOTHING;
