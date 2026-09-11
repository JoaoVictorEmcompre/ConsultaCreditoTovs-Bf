import {useContext} from 'react';
import {ModelosContext} from './ModelosContext';

export function useModelos() {
    return useContext(ModelosContext);
}