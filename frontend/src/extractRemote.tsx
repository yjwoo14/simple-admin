import * as React from 'react';
import CircularProgress from '@material-ui/core/CircularProgress';
import { Remote } from './Remote';

type ExtractRemoteGood<T> = {s: 'd', d: T};
type ExtractRemoteBad = {s: 'e', d: React.ReactElement};
type ExtractRemote<T> = ExtractRemoteGood<T> | ExtractRemoteBad;

function extractRemote<T, E>(r: Remote<T, E> | null | undefined) :  ExtractRemote<T> {
    if (r == null)
        return {s: 'e', d: <span>Internal error: undefined remote</span>};
    switch (r.state) {
        case 'initial': return {s: 'e', d: <span>Internal error: Remote in initial state</span>};
        case 'loading': return {s: 'e', d: <CircularProgress />};
        case 'error': return {s: 'e', d: <span>Error loading remote content</span>};
        case 'data': return {s: 'd', d: r.data};
    }
}

export default extractRemote;
