import { Outlet } from 'react-router-dom';
import AuthFrame from './AuthFrame';

const AuthShell = () => <AuthFrame><Outlet /></AuthFrame>;

export default AuthShell;
