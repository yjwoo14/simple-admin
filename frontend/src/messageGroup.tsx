import * as React from 'react';
import {IMainState} from './reducers';
import {ISetMessageGroupExpanded, ISetMessagesDismissed, ACTION, IMessage} from '../../shared/actions'
import {hostId} from '../../shared/type'
import {connect, Dispatch } from 'react-redux';
import {debugStyle} from './debug';
import { createSelector } from 'reselect';
import RaisedButton from 'material-ui/RaisedButton';
import {Message} from './message';
import { observer } from 'mobx-react';
import state from './state';

interface ExternProps {
    ids: number[];
    start: number;
    end: number;
    dismissed: number;
}

interface StateProps {
    message: IMessage;
    ids: number[];
    end: number;
    dismissed: number;
    expanded: boolean;
}

const getMessages = (state:IMainState) => state.messages;

const makeMapStatToProps = () => {
    const getIds = (_:IMainState, p: ExternProps) => p.ids;
    const getEnd = (_:IMainState, p: ExternProps) => p.end;
    const getDismissed = (_:IMainState, p: ExternProps) => p.dismissed; 
    const getExpanded = (state: IMainState, p: ExternProps) => state.messageGroupExpanded[p.ids[0]];    
    return createSelector([getIds, getEnd, getDismissed, getMessages, getExpanded], (ids, end, dismissed, messages, expanded )=> {
        return {message: messages[ids[0]], ids, end, dismissed, expanded};
    });
};

interface DispatchProps {
    toggle(dismissed:boolean): void;
    setExpanded(expanded: boolean): void;
}

function mapDispatchToProps(dispatch:Dispatch<IMainState>, o:ExternProps): DispatchProps {
    return {
        toggle: (dismissed: boolean) => {
            const p:ISetMessagesDismissed = {
                type: ACTION.SetMessagesDismissed,
                ids: o.ids,
                dismissed,
                source: "webclient"
            };
            dispatch(p);
        },
        setExpanded: (expanded: boolean) => {
            const p:ISetMessageGroupExpanded = {
                type: ACTION.SetMessageGroupExpanded,
                id: o.ids[0],
                expanded
            };
            dispatch(p);
        }
    }
}

const MessageGroupImpl = observer((p:StateProps & DispatchProps) => {
    const hostname = state.objectDigests.get(hostId).get(p.message.host).name;

    const newDate = new Date(p.end * 1000);
    let actions = [];
    let c;
    if (p.dismissed != 0) {
        actions.push(<RaisedButton key="undismiss" label="Undismiss all" primary={true} onClick={()=>p.toggle(false)}/>);
        c = "message_good";
    }
    if (p.dismissed != p.ids.length) {
        actions.push(<RaisedButton key="dismiss" label="Dismiss all" primary={true} onClick={()=>p.toggle(true)}/>);
        c = "message_bad";
    }
    if (p.expanded)
        actions.push(<RaisedButton key="contract" label="Contract" primary={true} onClick={()=>p.setExpanded(false)}/>);
    else
        actions.push(<RaisedButton key="expand" label="Expand" primary={true} onClick={()=>p.setExpanded(true)}/>);
    
    let rows = [<tr style={debugStyle()} className={c} key={p.ids[0]+"_root"}><td>{p.message.type} ({p.ids.length})</td><td>{hostname}</td><td></td><td>{newDate.toUTCString()}</td><td>{actions}</td></tr>];
    if (p.expanded) {
        for (const id of p.ids) {
            rows.push(<Message key={id} inGroup={true} id={id}/>);
        }
    }
    return rows as any;
});

export const MessageGroup = connect<StateProps, DispatchProps, ExternProps>(makeMapStatToProps, mapDispatchToProps)(MessageGroupImpl);
