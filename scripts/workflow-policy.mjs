export function hasWritePermission(permissions) {
  if (permissions === 'write-all') return true;
  return Boolean(
    permissions
      && typeof permissions === 'object'
      && Object.values(permissions).some((value) => value === 'write'),
  );
}
